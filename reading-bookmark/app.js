const STORAGE_KEY = "reading-bookmark-public-v1";

const defaultOptionCatalog = {
  fileFormats: [],
  readingStatuses: [],
  sources: [],
  types: [],
  scenes: [],
  tags: [],
  subtags: []
};

const languageOptions = ["中", "EN", "中译"];
const sharedTextFields = ["summary", "plot", "notes", "highlights"];
const deprecatedFileFormats = [];
const deprecatedSources = [];
const deprecatedTypes = [];
const sortOptions = [
  { key: "rating", label: "评分", type: "number", defaultDirection: "desc" },
  { key: "progressPercent", label: "进度", type: "number", defaultDirection: "desc" },
  { key: "wordCountK", label: "字数", type: "number", defaultDirection: "desc" },
  { key: "title", label: "书名", type: "text", defaultDirection: "asc" },
  { key: "author", label: "作者", type: "text", defaultDirection: "asc" },
  { key: "updatedAt", label: "最近编辑", type: "date", defaultDirection: "desc" },
  { key: "createdAt", label: "添加时间", type: "date", defaultDirection: "desc" }
];
const filterGroups = [
  { key: "language", label: "语言", mode: "single" },
  { key: "author", label: "作者", mode: "multi" },
  { key: "fileFormats", label: "文件格式", mode: "multi" },
  { key: "readingStatuses", label: "阅读状态", mode: "multi" },
  { key: "sources", label: "来源", mode: "multi" },
  { key: "types", label: "类型", mode: "multi" },
  { key: "scenes", label: "场景", mode: "multi" },
  { key: "tags", label: "大标签", mode: "multi" },
  { key: "subtags", label: "小标签", mode: "multi" }
];

const emptyBook = () => ({
  id: createId(),
  title: "未命名书籍",
  author: "",
  language: "中",
  textRecordId: createId(),
  wordCountK: 0,
  progressPercent: 0,
  rating: 0,
  link: "",
  fileFormats: [],
  readingStatuses: [],
  sources: [],
  types: [],
  scenes: [],
  tags: [],
  subtags: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
});

const emptySharedText = id => ({
  id,
  summary: "",
  plot: "",
  notes: "",
  highlights: "",
  updatedAt: new Date().toISOString()
});

let state = loadState();
let selectedBookId = state.books[0]?.id ?? null;
let searchTerm = "";
let openDropdown = null;
let openFilterDropdown = null;
let pendingTagDelete = null;
let filters = emptyFilters();
let isFilterPanelOpen = false;
let sortKey = "updatedAt";
let sortDirection = "desc";
let activeView = "library";
let statusTimer = null;
let currentExportText = "";
let currentExportFilename = "";

const appShell = document.querySelector(".app-shell");
const bookList = document.querySelector("#bookList");
const detailPanel = document.querySelector("#detailPanel");
const libraryPanel = document.querySelector(".library-panel");
const libraryCount = document.querySelector("#libraryCount");
const searchInput = document.querySelector("#searchInput");
const backToLibraryButton = document.querySelector("#backToLibrary");
const filterToggle = document.querySelector("#filterToggle");
const filterCount = document.querySelector("#filterCount");
const clearFiltersButton = document.querySelector("#clearFilters");
const activeFilters = document.querySelector("#activeFilters");
const filterPanel = document.querySelector("#filterPanel");
const importDataButton = document.querySelector("#importData");
const exportDataButton = document.querySelector("#exportData");
const importFileInput = document.querySelector("#importFile");
const dataStatus = document.querySelector("#dataStatus");
const importPanel = document.querySelector("#importPanel");
const importText = document.querySelector("#importText");
const closeImportButton = document.querySelector("#closeImport");
const chooseImportFileButton = document.querySelector("#chooseImportFile");
const applyImportTextButton = document.querySelector("#applyImportText");
const exportPanel = document.querySelector("#exportPanel");
const exportText = document.querySelector("#exportText");
const exportMeta = document.querySelector("#exportMeta");
const closeExportButton = document.querySelector("#closeExport");
const copyExportButton = document.querySelector("#copyExport");
const selectExportButton = document.querySelector("#selectExport");

document.querySelector("#addBook").addEventListener("click", addBook);
backToLibraryButton.addEventListener("click", () => {
  activeView = "library";
  openDropdown = null;
  pendingTagDelete = null;
  render();
});
filterToggle.addEventListener("click", () => {
  isFilterPanelOpen = !isFilterPanelOpen;
  openFilterDropdown = null;
  renderFilters();
});
clearFiltersButton.addEventListener("click", () => {
  filters = emptyFilters();
  openFilterDropdown = null;
  render();
});
searchInput.addEventListener("input", event => {
  searchTerm = event.target.value.trim().toLowerCase();
  render();
});
importDataButton.addEventListener("click", openImportPanel);
exportDataButton.addEventListener("click", exportLibraryFile);
importFileInput.addEventListener("change", importLibraryFile);
closeImportButton.addEventListener("click", closeImportPanel);
chooseImportFileButton.addEventListener("click", () => {
  importFileInput.value = "";
  importFileInput.click();
});
applyImportTextButton.addEventListener("click", importLibraryText);
closeExportButton.addEventListener("click", closeExportPanel);
copyExportButton.addEventListener("click", copyExportText);
selectExportButton.addEventListener("click", selectExportText);
importPanel.addEventListener("click", event => {
  if (event.target === importPanel) {
    closeImportPanel();
  }
});
exportPanel.addEventListener("click", event => {
  if (event.target === exportPanel) {
    closeExportPanel();
  }
});

document.addEventListener("click", event => {
  const dropdown = event.target.closest("[data-dropdown]");
  const filterDropdown = event.target.closest("[data-filter-dropdown]");
  const tagDeleteButton = event.target.closest("[data-delete-tag-value]");

  if (!dropdown && openDropdown) {
    openDropdown = null;
    renderDetail();
  }

  if (!filterDropdown && openFilterDropdown) {
    openFilterDropdown = null;
    renderFilters();
  }

  if (!tagDeleteButton && pendingTagDelete) {
    pendingTagDelete = null;
    renderDetail();
  }
});

render();
registerServiceWorker();

function loadState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      return normalizeState(JSON.parse(saved));
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  return normalizeState(emptyLibrary());
}

function emptyLibrary() {
  return {
    schemaVersion: 1,
    libraryId: "public-deploy",
    updatedAt: new Date().toISOString(),
    optionCatalog: cloneDefaultOptionCatalog(),
    sharedTexts: {},
    books: []
  };
}

function normalizeState(rawState) {
  const normalized = {
    schemaVersion: rawState.schemaVersion ?? 1,
    libraryId: rawState.libraryId ?? "public-deploy",
    updatedAt: rawState.updatedAt ?? new Date().toISOString(),
    optionCatalog: {
      ...cloneDefaultOptionCatalog(),
      ...(rawState.optionCatalog ?? {})
    },
    sharedTexts: { ...(rawState.sharedTexts ?? {}) },
    books: Array.isArray(rawState.books) ? rawState.books : []
  };

  normalized.optionCatalog.fileFormats = cleanFileFormats(normalized.optionCatalog.fileFormats);
  normalized.optionCatalog.sources = cleanSources(normalized.optionCatalog.sources);
  normalized.optionCatalog.types = cleanTypes(normalized.optionCatalog.types);

  normalized.books = normalized.books.map(book => {
    const bookWithoutRemovedFields = { ...book };
    delete bookWithoutRemovedFields.coverURL;

    return {
      ...emptyBook(),
      ...bookWithoutRemovedFields,
      language: languageOptions.includes(book.language) ? book.language : "中",
      fileFormats: cleanFileFormats(ensureArray(book.fileFormats)),
      readingStatuses: ensureArray(book.readingStatuses),
      sources: cleanSources(ensureArray(book.sources)),
      types: cleanTypes(book.types),
      scenes: ensureArray(book.scenes),
      tags: ensureArray(book.tags),
      subtags: ensureArray(book.subtags)
    };
  });

  normalized.books.forEach(book => {
    const textRecordId = book.textRecordId || createId();
    book.textRecordId = textRecordId;

    if (!normalized.sharedTexts[textRecordId]) {
      normalized.sharedTexts[textRecordId] = emptySharedText(textRecordId);
    }

    sharedTextFields.forEach(field => {
      if (!normalized.sharedTexts[textRecordId][field] && book[field]) {
        normalized.sharedTexts[textRecordId][field] = book[field];
      }
    });
  });

  ["tags", "subtags"].forEach(key => {
    normalized.books.forEach(book => {
      book[key].forEach(value => {
        if (!normalized.optionCatalog[key].includes(value)) {
          normalized.optionCatalog[key].push(value);
        }
      });
    });
  });

  return normalized;
}

function cloneDefaultOptionCatalog() {
  return Object.fromEntries(
    Object.entries(defaultOptionCatalog).map(([key, values]) => [key, [...values]])
  );
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function cleanFileFormats(values) {
  return ensureArray(values).filter(value => !deprecatedFileFormats.includes(value));
}

function cleanSources(values) {
  return ensureArray(values).filter(value => !deprecatedSources.includes(value));
}

function cleanTypes(values) {
  return ensureArray(values).filter(value => !deprecatedTypes.includes(value));
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function saveState() {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderViewState() {
  appShell.classList.toggle("view-library", activeView === "library");
  appShell.classList.toggle("view-detail", activeView === "detail");
  backToLibraryButton.hidden = activeView !== "detail";
}

function render() {
  renderBookList();
  renderDetail();
  renderFilters();
  renderViewState();
}

async function exportLibraryFile() {
  const snapshot = normalizedSnapshot();
  currentExportFilename = `reading-bookmark-${dateStamp(new Date())}.readingbookmark`;
  currentExportText = JSON.stringify(snapshot, null, 2);

  exportMeta.textContent = `${snapshot.books.length} 本书 · ${currentExportFilename}`;
  exportText.value = currentExportText;
  exportPanel.hidden = false;
  showStatus("同步文本已准备好");
}

function closeExportPanel() {
  exportPanel.hidden = true;
}

async function copyExportText() {
  if (!currentExportText) {
    exportLibraryFile();
  }

  try {
    await navigator.clipboard.writeText(currentExportText);
    showStatus("已复制数据库文本");
    return;
  } catch (error) {
    console.warn("Clipboard export failed, falling back to selection.", error);
  }

  exportText.focus();
  exportText.select();

  try {
    document.execCommand("copy");
    showStatus("已复制数据库文本");
  } catch (error) {
    console.warn("Legacy clipboard export failed.", error);
    showStatus("已选中文本，请手动复制");
  }
}

function selectExportText() {
  exportText.focus();
  exportText.select();
  exportText.setSelectionRange(0, exportText.value.length);
  showStatus("已选中同步文本");
}

function openImportPanel() {
  importText.value = "";
  importPanel.hidden = false;
  showStatus("可以导入文件或文本");
}

function closeImportPanel() {
  importPanel.hidden = true;
}

async function importLibraryFile() {
  const file = importFileInput.files?.[0];
  if (!file) return;

  try {
    const rawText = await file.text();
    importRawLibrary(rawText);
  } catch (error) {
    console.error(error);
    showStatus("导入失败，请确认文件格式");
  }
}

function importLibraryText() {
  const rawText = importText.value.trim();
  if (!rawText) {
    showStatus("先粘贴数据库文本");
    return;
  }

  importRawLibrary(rawText);
}

function importRawLibrary(rawText) {
  try {
    const importedState = normalizeState(JSON.parse(rawText));
    const shouldMerge = !state.books.length || window.confirm("导入会合并数据库：新增卡片会加入，较新的同一卡片会替换较旧版本，本机独有卡片会保留。继续吗？");

    if (!shouldMerge) {
      showStatus("已取消导入");
      return;
    }

    const mergeResult = mergeImportedState(importedState);
    selectedBookId = state.books.some(book => book.id === selectedBookId)
      ? selectedBookId
      : state.books[0]?.id ?? null;
    activeView = "library";
    openDropdown = null;
    openFilterDropdown = null;
    pendingTagDelete = null;
    filters = emptyFilters();
    saveState();
    closeImportPanel();
    render();
    showStatus(`已合并：新增 ${mergeResult.added}，更新 ${mergeResult.updated}，保留 ${mergeResult.kept}`);
  } catch (error) {
    console.error(error);
    showStatus("导入失败，请确认文本格式");
  }
}

function mergeImportedState(importedState) {
  const currentBooksById = new Map(state.books.map((book, index) => [book.id, { book, index }]));
  const importedBookIds = new Set(importedState.books.map(book => book.id));
  const mergedBooks = state.books.map(book => cloneData(book));
  const result = {
    added: 0,
    updated: 0,
    kept: 0
  };

  importedState.books.forEach(importedBook => {
    const existing = currentBooksById.get(importedBook.id);
    if (!existing) {
      mergedBooks.push(cloneData(importedBook));
      result.added += 1;
      return;
    }

    if (dateValue(importedBook.updatedAt) > dateValue(existing.book.updatedAt)) {
      mergedBooks[existing.index] = cloneData(importedBook);
      result.updated += 1;
    } else {
      result.kept += 1;
    }
  });

  state.books.forEach(book => {
    if (!importedBookIds.has(book.id)) {
      result.kept += 1;
    }
  });

  state = normalizeState({
    ...state,
    optionCatalog: mergeOptionCatalogs(state.optionCatalog, importedState.optionCatalog),
    sharedTexts: mergeSharedTexts(state.sharedTexts, importedState.sharedTexts),
    books: mergedBooks
  });

  return result;
}

function mergeSharedTexts(currentTexts, importedTexts) {
  const merged = cloneData(currentTexts);

  Object.entries(importedTexts ?? {}).forEach(([id, importedText]) => {
    const existingText = merged[id];
    if (!existingText || dateValue(importedText.updatedAt) > dateValue(existingText.updatedAt)) {
      merged[id] = cloneData(importedText);
    }
  });

  return merged;
}

function mergeOptionCatalogs(currentCatalog, importedCatalog) {
  const keys = new Set([
    ...Object.keys(cloneDefaultOptionCatalog()),
    ...Object.keys(currentCatalog ?? {}),
    ...Object.keys(importedCatalog ?? {})
  ]);

  return Object.fromEntries([...keys].map(key => [
    key,
    cleanCatalogValues(key, dedupeValues([
      ...ensureArray(currentCatalog?.[key]),
      ...ensureArray(importedCatalog?.[key])
    ]))
  ]));
}

function cleanCatalogValues(key, values) {
  if (key === "fileFormats") return cleanFileFormats(values);
  if (key === "sources") return cleanSources(values);
  if (key === "types") return cleanTypes(values);
  return values;
}

function dedupeValues(values) {
  return [...new Set(values.filter(value => typeof value === "string" && value.trim()))];
}

function cloneData(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizedSnapshot() {
  return normalizeState(JSON.parse(JSON.stringify(state)));
}

function dateStamp(date) {
  const pad = value => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate())
  ].join("-");
}

function showStatus(message) {
  dataStatus.textContent = message;
  dataStatus.classList.add("is-visible");
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => {
    dataStatus.classList.remove("is-visible");
  }, 2600);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;

  navigator.serviceWorker.register("./sw.js").catch(error => {
    console.warn("Service worker registration failed.", error);
  });
}

function renderBookList() {
  const books = filteredBooks();
  syncSelectionToBooks(books);
  libraryCount.textContent = `${books.length} / ${state.books.length} 本书`;

  bookList.innerHTML = books.map((book, index) => {
    const active = book.id === selectedBookId ? " is-active" : "";
    return `
      <button class="book-card${active}" type="button" data-select-book="${book.id}">
        ${coverMarkup(book, "book-cover")}
        <div>
          <h2>${escapeHtml(book.title || "未命名书籍")}</h2>
          <p>${escapeHtml(listCardDescription(book))}</p>
          <div class="mini-progress"><span style="width: ${clamp(book.progressPercent, 0, 100)}%"></span></div>
          <div class="book-meta">
            <span>${formatPercent(book.progressPercent)}</span>
            <span class="book-rating">${formatDecimal(book.rating)}</span>
          </div>
        </div>
      </button>
    `;
  }).join("");

  bookList.querySelectorAll("[data-select-book]").forEach(button => {
    button.addEventListener("click", () => {
      selectedBookId = button.dataset.selectBook;
      openDropdown = null;
      activeView = "detail";
      render();
    });
  });
}

function syncSelectionToBooks(books) {
  if (!books.length) {
    selectedBookId = null;
    return;
  }

  if (!books.some(book => book.id === selectedBookId)) {
    selectedBookId = books[0].id;
  }
}

function filteredBooks() {
  const books = state.books.filter(book => {
    const haystack = [
      book.title,
      book.author,
      book.language,
      ...book.fileFormats,
      ...book.readingStatuses,
      ...book.sources,
      ...book.types,
      ...book.scenes,
      ...book.tags,
      ...book.subtags
    ].join(" ").toLowerCase();

    return (!searchTerm || haystack.includes(searchTerm)) && matchesFilters(book);
  });

  return sortedBooks(books);
}

function sortedBooks(books) {
  const option = currentSortOption();

  return [...books].sort((bookA, bookB) => {
    const emptyDelta = emptySortRank(option, bookA) - emptySortRank(option, bookB);
    if (emptyDelta !== 0) return emptyDelta;

    const comparison = compareSortValues(option, bookA, bookB);
    if (comparison !== 0) {
      return sortDirection === "asc" ? comparison : -comparison;
    }

    return fallbackBookCompare(bookA, bookB);
  });
}

function currentSortOption() {
  return sortOptions.find(option => option.key === sortKey) ?? sortOptions[0];
}

function compareSortValues(option, bookA, bookB) {
  if (option.type === "number") {
    return Number(bookA[option.key] || 0) - Number(bookB[option.key] || 0);
  }

  if (option.type === "date") {
    return dateValue(bookA[option.key]) - dateValue(bookB[option.key]);
  }

  return textSortValue(bookA[option.key]).localeCompare(textSortValue(bookB[option.key]), "zh-Hans", {
    numeric: true,
    sensitivity: "base"
  });
}

function emptySortRank(option, book) {
  if (option.type === "date") {
    return Number.isFinite(Date.parse(book[option.key])) ? 0 : 1;
  }

  if (option.type === "text") {
    return textSortValue(book[option.key]) ? 0 : 1;
  }

  return 0;
}

function fallbackBookCompare(bookA, bookB) {
  const dateDelta = dateValue(bookB.updatedAt) - dateValue(bookA.updatedAt);
  if (dateDelta !== 0) return dateDelta;

  return textSortValue(bookA.title).localeCompare(textSortValue(bookB.title), "zh-Hans", {
    numeric: true,
    sensitivity: "base"
  });
}

function dateValue(value) {
  const time = Date.parse(value);
  return Number.isFinite(time) ? time : 0;
}

function textSortValue(value) {
  return String(value || "").trim();
}

function matchesFilters(book) {
  return filterGroups.every(group => {
    const selected = filters[group.key];
    if (!selected.length) return true;

    const bookValues = filterValuesForBook(book, group);
    return selected.some(value => bookValues.includes(value));
  });
}

function renderFilters() {
  const activeCount = activeFilterEntries().length;

  filterCount.textContent = activeCount;
  filterCount.hidden = activeCount === 0;
  clearFiltersButton.disabled = activeCount === 0;
  filterToggle.setAttribute("aria-expanded", String(isFilterPanelOpen));
  libraryPanel.classList.toggle("is-filter-open", isFilterPanelOpen);
  filterPanel.hidden = !isFilterPanelOpen;

  activeFilters.innerHTML = activeCount
    ? activeFilterEntries().map(entry => `
      <button class="active-filter-chip" type="button" data-remove-filter-key="${entry.key}" data-remove-filter-value="${escapeAttribute(entry.value)}">
        <span>${escapeHtml(entry.label)}：${escapeHtml(entry.value)}</span>
        <b aria-hidden="true">×</b>
      </button>
    `).join("")
    : "";

  filterPanel.innerHTML = `
    ${sortPanelMarkup()}
    ${filterGroups.map(filterGroupMarkup).join("")}
  `;

  activeFilters.querySelectorAll("[data-remove-filter-key]").forEach(button => {
    button.addEventListener("click", () => {
      removeFilterValue(button.dataset.removeFilterKey, button.dataset.removeFilterValue);
    });
  });

  filterPanel.querySelectorAll("[data-filter-key]").forEach(button => {
    button.addEventListener("click", () => {
      toggleFilterValue(button.dataset.filterKey, button.dataset.filterValue);
    });
  });

  filterPanel.querySelectorAll("[data-filter-menu-trigger]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const key = button.dataset.filterMenuTrigger;
      openFilterDropdown = openFilterDropdown === key ? null : key;
      renderFilters();
    });
  });

  filterPanel.querySelectorAll("[data-filter-toggle]").forEach(input => {
    input.addEventListener("change", event => {
      toggleFilterValue(event.currentTarget.dataset.filterToggle, event.currentTarget.value);
    });
  });

  filterPanel.querySelectorAll("[data-sort-menu-trigger]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const key = button.dataset.sortMenuTrigger;
      openFilterDropdown = openFilterDropdown === key ? null : key;
      renderFilters();
    });
  });

  filterPanel.querySelectorAll("[data-sort-field-option]").forEach(input => {
    input.addEventListener("change", event => {
      sortKey = event.currentTarget.value;
      sortDirection = currentSortOption().defaultDirection;
      openFilterDropdown = null;
      render();
    });
  });

  filterPanel.querySelectorAll("[data-sort-direction-option]").forEach(input => {
    input.addEventListener("change", event => {
      sortDirection = event.currentTarget.value;
      openFilterDropdown = null;
      render();
    });
  });
}

function sortPanelMarkup() {
  return `
    <div class="filter-group filter-sort-group">
      <div class="filter-group-title">排序</div>
      <div class="filter-sort-controls">
        ${sortDropdownMarkup({
          key: "sort-field",
          label: "排序",
          summary: currentSortOption().label,
          options: sortOptions.map(option => ({ value: option.key, label: option.label })),
          selectedValue: currentSortOption().key,
          dataAttribute: "data-sort-field-option",
          name: "sortField"
        })}
        ${sortDropdownMarkup({
          key: "sort-direction",
          label: "方向",
          summary: sortDirectionLabel(sortDirection),
          options: [
            { value: "desc", label: "降序" },
            { value: "asc", label: "升序" }
          ],
          selectedValue: sortDirection,
          dataAttribute: "data-sort-direction-option",
          name: "sortDirection"
        })}
      </div>
    </div>
  `;
}

function sortDropdownMarkup(config) {
  const isOpen = openFilterDropdown === config.key;

  return `
    <div class="dropdown-field${isOpen ? " is-open" : ""}" data-filter-dropdown>
      <span class="field-label">${escapeHtml(config.label)}</span>
      <button class="select-trigger" type="button" data-sort-menu-trigger="${config.key}" aria-expanded="${isOpen}">
        <strong>${escapeHtml(config.summary)}</strong>
        <span aria-hidden="true">⌄</span>
      </button>
      <div class="dropdown-menu">
        ${config.options.map(option => `
          <label class="option-row">
            <input type="radio" name="${escapeAttribute(config.name)}" ${config.dataAttribute} value="${escapeAttribute(option.value)}" ${option.value === config.selectedValue ? "checked" : ""}>
            <span>${escapeHtml(option.label)}</span>
          </label>
        `).join("")}
      </div>
    </div>
  `;
}

function sortDirectionLabel(direction) {
  return direction === "asc" ? "升序" : "降序";
}

function filterGroupMarkup(group) {
  if (group.mode === "multi") {
    return filterDropdownMarkup(group);
  }

  return `
    <div class="filter-group">
      <div class="filter-group-title">${escapeHtml(group.label)}</div>
      <div class="filter-options">
        ${filterOptionsFor(group).map(option => `
          <button class="filter-option${filters[group.key].includes(option) ? " is-selected" : ""}" type="button" data-filter-key="${group.key}" data-filter-value="${escapeAttribute(option)}">
            ${filters[group.key].includes(option) ? '<span aria-hidden="true">✓</span>' : ""}
            <span>${escapeHtml(option)}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

function filterDropdownMarkup(group) {
  const selected = filters[group.key];
  const isOpen = openFilterDropdown === group.key;

  return `
    <div class="filter-group dropdown-field${isOpen ? " is-open" : ""}" data-filter-dropdown>
      <span class="field-label">${escapeHtml(group.label)}</span>
      <button class="select-trigger" type="button" data-filter-menu-trigger="${group.key}" aria-expanded="${isOpen}">
        <strong>${escapeHtml(selectionSummary(selected))}</strong>
        <span aria-hidden="true">⌄</span>
      </button>
      <div class="dropdown-menu">
        ${filterOptionsFor(group).map(option => `
          <label class="option-row">
            <input type="checkbox" data-filter-toggle="${group.key}" value="${escapeAttribute(option)}" ${selected.includes(option) ? "checked" : ""}>
            <span>${escapeHtml(option)}</span>
          </label>
        `).join("")}
      </div>
    </div>
  `;
}

function activeFilterEntries() {
  return filterGroups.flatMap(group =>
    filters[group.key].map(value => ({
      key: group.key,
      label: group.label,
      value
    }))
  );
}

function filterOptionsFor(group) {
  const options = filterBaseOptions(group.key, filters[group.key]);
  return sortedOptionsForKey(group.key, options, filters[group.key]);
}

function selectionSummary(selected) {
  return selected.length ? selected.join("、") : "未选择";
}

function toggleFilterValue(key, value) {
  const group = filterGroups.find(candidate => candidate.key === key);
  if (!group) return;

  const selected = filters[key];
  const index = selected.indexOf(value);

  if (index >= 0) {
    selected.splice(index, 1);
  } else if (group.mode === "single") {
    filters[key] = [value];
  } else {
    selected.push(value);
  }

  render();
}

function removeFilterValue(key, value) {
  filters[key] = filters[key].filter(selected => selected !== value);
  render();
}

function emptyFilters() {
  return Object.fromEntries(filterGroups.map(group => [group.key, []]));
}

function renderDetail() {
  const book = selectedBook();

  if (!book) {
    detailPanel.innerHTML = `
      <div class="empty-state">
        <div>
          <strong>没有选中的书</strong>
          <span>新增一本或从书架里选择。</span>
        </div>
      </div>
    `;
    return;
  }

  const sharedText = textRecordFor(book);
  const linkedVersions = linkedBooksFor(book);

  detailPanel.innerHTML = `
    <div class="detail-grid">
      <div class="main-column">
        <section class="hero-panel">
          ${coverMarkup(book, "large-cover")}
          <div class="hero-copy">
            <input class="title-input" data-field="title" value="${escapeAttribute(book.title)}" aria-label="书名">
            <input class="author-input" data-field="author" value="${escapeAttribute(book.author)}" placeholder="作者" aria-label="作者">
            <div class="status-row">
              ${pillGroup([book.language], "语言")}
              ${pillGroup(book.readingStatuses, "阅读状态")}
              ${pillGroup(book.fileFormats, "文件格式", true)}
            </div>
            <div class="progress-block">
              <div class="progress-label">
                <span>进度</span>
                <span>${formatPercent(book.progressPercent)} · ${formatDecimal(book.rating)}</span>
              </div>
              <div class="progress-bar"><span style="width: ${clamp(book.progressPercent, 0, 100)}%"></span></div>
            </div>
          </div>
        </section>

        <section class="form-section">
          <h3>文本记录</h3>
          <p class="section-note">${linkedVersions.length ? `与 ${escapeHtml(linkedVersions.map(version => version.title).join("、"))} 共享` : "当前版本单独使用这份文本记录"}</p>
          <div class="field">
            <label for="summary">简介</label>
            <textarea id="summary" data-shared-field="summary">${escapeHtml(sharedText.summary)}</textarea>
          </div>
          <div class="field">
            <label for="plot">剧情</label>
            <textarea id="plot" data-shared-field="plot">${escapeHtml(sharedText.plot)}</textarea>
          </div>
          <div class="field">
            <label for="notes">笔记</label>
            <textarea id="notes" data-shared-field="notes">${escapeHtml(sharedText.notes)}</textarea>
          </div>
          <div class="field">
            <label for="highlights">高亮</label>
            <textarea id="highlights" data-shared-field="highlights">${escapeHtml(sharedText.highlights)}</textarea>
          </div>
        </section>
      </div>

      <div class="side-column">
        <section class="form-section">
          <h3>基本信息</h3>
          <div class="field-grid">
            ${singleSelectField("语言", "language", book.language, languageOptions)}
            ${versionLinkField(book)}
            ${numberField("字数", "wordCountK", book.wordCountK, "k", 0, 9999, 0.1)}
            ${numberField("进度", "progressPercent", book.progressPercent, "%", 0, 100, 0.1)}
            ${numberField("打分", "rating", book.rating, "/10", 0, 10, 0.1)}
            ${textField("链接", "link", book.link, "url")}
          </div>
        </section>

        <section class="form-section">
          <h3>分类</h3>
          <div class="field-grid">
            ${multiSelectDropdown("文件格式", "fileFormats", book.fileFormats)}
            ${multiSelectDropdown("阅读状态", "readingStatuses", book.readingStatuses)}
            ${multiSelectDropdown("来源", "sources", book.sources)}
            ${multiSelectDropdown("类型", "types", book.types)}
            ${multiSelectList("场景", "scenes", book.scenes)}
          </div>
        </section>

        <section class="form-section">
          <h3>两层标签</h3>
          ${tagSelector("大标签", "tags", book.tags)}
          ${tagSelector("小标签", "subtags", book.subtags)}
        </section>

        <div class="detail-footer">
          <button class="danger-button" type="button" data-delete-book>删除这本书</button>
        </div>
      </div>
    </div>
  `;

  bindDetailEvents();
}

function bindDetailEvents() {
  detailPanel.querySelectorAll("[data-field]").forEach(input => {
    input.addEventListener("input", event => {
      updateField(event.currentTarget.dataset.field, event.currentTarget.value);
      updateDetailCover();
    });
  });

  detailPanel.querySelector('[data-field="link"]')?.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.currentTarget.blur();
    }
  });

  detailPanel.querySelectorAll("[data-shared-field]").forEach(input => {
    input.addEventListener("input", event => {
      updateSharedTextField(event.currentTarget.dataset.sharedField, event.currentTarget.value);
    });
  });

  detailPanel.querySelectorAll("[data-select-field]").forEach(select => {
    select.addEventListener("change", event => {
      updateField(event.currentTarget.dataset.selectField, event.currentTarget.value);
      render();
    });
  });

  detailPanel.querySelector("[data-version-link]")?.addEventListener("change", event => {
    linkSelectedBookTo(event.currentTarget.value);
  });

  detailPanel.querySelector("[data-jump-version]")?.addEventListener("click", event => {
    jumpToVersion(event.currentTarget.dataset.jumpVersion);
  });

  detailPanel.querySelectorAll("[data-menu-trigger]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      const key = button.dataset.menuTrigger;
      openDropdown = openDropdown === key ? null : key;
      renderDetail();
    });
  });

  detailPanel.querySelectorAll("[data-toggle]").forEach(input => {
    input.addEventListener("change", event => {
      const { key, value } = event.currentTarget.dataset;
      toggleValue(key, value);
    });
  });

  detailPanel.querySelectorAll("[data-chip-value]").forEach(button => {
    button.addEventListener("click", () => {
      toggleValue(button.dataset.chipKey, button.dataset.chipValue);
    });
  });

  detailPanel.querySelectorAll("[data-delete-tag-value]").forEach(button => {
    button.addEventListener("click", event => {
      event.stopPropagation();
      requestTagDelete(button.dataset.deleteTagKey, button.dataset.deleteTagValue);
    });
  });

  detailPanel.querySelectorAll("[data-add-custom]").forEach(button => {
    button.addEventListener("click", () => {
      const key = button.dataset.addCustom;
      const input = detailPanel.querySelector(`[data-custom-input="${key}"]`);
      addCustomValue(key, input.value);
    });
  });

  detailPanel.querySelector("[data-delete-book]")?.addEventListener("click", deleteSelectedBook);
}

function selectedBook() {
  return state.books.find(book => book.id === selectedBookId) ?? state.books[0] ?? null;
}

function textRecordFor(book) {
  if (!state.sharedTexts[book.textRecordId]) {
    state.sharedTexts[book.textRecordId] = emptySharedText(book.textRecordId);
  }

  return state.sharedTexts[book.textRecordId];
}

function linkedBooksFor(book) {
  return state.books.filter(candidate => candidate.id !== book.id && candidate.textRecordId === book.textRecordId);
}

function updateField(field, rawValue) {
  const book = selectedBook();
  if (!book) return;

  const numericFields = new Set(["wordCountK", "progressPercent", "rating"]);
  if (numericFields.has(field)) {
    const value = Number(rawValue);
    const ranges = {
      wordCountK: [0, 9999],
      progressPercent: [0, 100],
      rating: [0, 10]
    };
    const [min, max] = ranges[field];
    book[field] = Number.isFinite(value) ? clamp(value, min, max) : 0;
  } else {
    book[field] = rawValue;
  }

  book.updatedAt = new Date().toISOString();
  saveState();
  renderBookList();
}

function updateSharedTextField(field, value) {
  const book = selectedBook();
  if (!book) return;

  const textRecord = textRecordFor(book);
  textRecord[field] = value;
  textRecord.updatedAt = new Date().toISOString();

  state.books
    .filter(candidate => candidate.textRecordId === book.textRecordId)
    .forEach(candidate => {
      candidate.updatedAt = new Date().toISOString();
    });

  saveState();
}

function linkSelectedBookTo(targetBookId) {
  const book = selectedBook();
  if (!book) return;

  if (targetBookId === "__none") {
    const newTextRecordId = createId();
    state.sharedTexts[newTextRecordId] = {
      ...textRecordFor(book),
      id: newTextRecordId,
      updatedAt: new Date().toISOString()
    };
    book.textRecordId = newTextRecordId;
  } else {
    const targetBook = state.books.find(candidate => candidate.id === targetBookId);
    if (targetBook) {
      book.textRecordId = targetBook.textRecordId;
    }
  }

  book.updatedAt = new Date().toISOString();
  saveState();
  render();
}

function jumpToVersion(targetBookId) {
  if (!targetBookId) return;

  const targetBook = state.books.find(book => book.id === targetBookId);
  if (!targetBook) return;

  selectedBookId = targetBook.id;
  openDropdown = null;
  render();
}

function toggleValue(key, value) {
  const book = selectedBook();
  if (!book) return;

  const values = book[key];
  const index = values.indexOf(value);

  if (index >= 0) {
    values.splice(index, 1);
  } else {
    values.push(value);
  }

  book.updatedAt = new Date().toISOString();
  saveState();
  render();
}

function addCustomValue(key, value) {
  const trimmed = value.trim();
  if (!trimmed) return;

  const book = selectedBook();
  if (!book[key].includes(trimmed)) {
    book[key].push(trimmed);
  }

  if (!state.optionCatalog[key].includes(trimmed)) {
    state.optionCatalog[key].push(trimmed);
  }

  book.updatedAt = new Date().toISOString();
  saveState();
  render();
}

function deleteTagOption(key, value) {
  pendingTagDelete = null;
  state.optionCatalog[key] = state.optionCatalog[key].filter(option => option !== value);

  state.books.forEach(book => {
    book[key] = book[key].filter(option => option !== value);
    book.updatedAt = new Date().toISOString();
  });

  saveState();
  render();
}

function requestTagDelete(key, value) {
  if (isPendingTagDelete(key, value)) {
    deleteTagOption(key, value);
    return;
  }

  pendingTagDelete = { key, value };
  renderDetail();
}

function isPendingTagDelete(key, value) {
  return pendingTagDelete?.key === key && pendingTagDelete.value === value;
}

function addBook() {
  const book = emptyBook();
  state.sharedTexts[book.textRecordId] = emptySharedText(book.textRecordId);
  state.books.unshift(book);
  selectedBookId = book.id;
  activeView = "detail";
  openDropdown = null;
  saveState();
  render();
}

function deleteSelectedBook() {
  const index = state.books.findIndex(book => book.id === selectedBookId);
  if (index < 0) return;

  state.books.splice(index, 1);
  selectedBookId = state.books[index]?.id ?? state.books[index - 1]?.id ?? null;
  activeView = "library";
  openDropdown = null;
  saveState();
  render();
}

function singleSelectField(label, key, selected, options) {
  const orderedOptions = sortedOptionsForKey(key, options, [selected]);

  return `
    <div class="field">
      <label for="${key}">${label}</label>
      <select id="${key}" data-select-field="${key}">
        ${orderedOptions.map(option => `
          <option value="${escapeAttribute(option)}" ${option === selected ? "selected" : ""}>${escapeHtml(option)}</option>
        `).join("")}
      </select>
    </div>
  `;
}

function versionLinkField(book) {
  const linkedVersions = linkedBooksFor(book);
  const linkedBookId = linkedVersions[0]?.id ?? "__none";
  const candidates = state.books.filter(candidate => candidate.id !== book.id);

  return `
    <div class="field version-link-field">
      <label for="versionLink">关联版本</label>
      <div class="version-link-control">
        <select id="versionLink" data-version-link>
          <option value="__none" ${linkedBookId === "__none" ? "selected" : ""}>不关联</option>
          ${candidates.map(candidate => `
            <option value="${escapeAttribute(candidate.id)}" ${candidate.id === linkedBookId ? "selected" : ""}>
              ${escapeHtml(candidate.title || "未命名书籍")} · ${escapeHtml(candidate.language)}
            </option>
          `).join("")}
        </select>
        <button class="jump-button" type="button" data-jump-version="${linkedBookId === "__none" ? "" : escapeAttribute(linkedBookId)}" ${linkedBookId === "__none" ? "disabled" : ""} aria-label="跳转到关联版本">↗</button>
      </div>
    </div>
  `;
}

function textField(label, key, value, type = "text") {
  return `
    <div class="field">
      <label for="${key}">${label}</label>
      <input id="${key}" type="${type}" data-field="${key}" value="${escapeAttribute(value)}">
    </div>
  `;
}

function coverMarkup(book, className) {
  const title = String(book.title || "").trim() || "未命名书籍";
  const detailAttribute = className === "large-cover" ? " data-detail-cover" : "";
  const footer = className === "large-cover"
    ? `<span class="cover-footer" data-cover-footer>${escapeHtml(coverFooter(book))}</span>`
    : "";

  return `
    <div class="${className}" data-cover-tone="${coverToneFor(book)}"${detailAttribute} aria-hidden="true">
      <span class="cover-title" data-cover-title>${escapeHtml(title)}</span>
      ${footer}
    </div>
  `;
}

function updateDetailCover() {
  const book = selectedBook();
  const cover = detailPanel.querySelector("[data-detail-cover]");
  if (!book || !cover) return;

  cover.querySelector("[data-cover-title]").textContent = String(book.title || "").trim() || "未命名书籍";
  cover.querySelector("[data-cover-footer]").textContent = coverFooter(book);
}

function coverFooter(book) {
  return String(book.author || "").trim() || "阅读记录";
}

function listCardDescription(book) {
  const tagText = book.tags.join("、");
  const statusText = book.readingStatuses.join("、");
  return [tagText, statusText].filter(Boolean).join(" · ") || "未填写大标签";
}

function coverToneFor(book) {
  const seed = String(book.id || book.title || "book");
  const total = Array.from(seed).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return total % 5;
}

function numberField(label, key, value, unit, min, max, step) {
  return `
    <div class="field">
      <label for="${key}">${label}</label>
      <input id="${key}" type="number" min="${min}" max="${max}" step="${step}" data-field="${key}" value="${escapeAttribute(value)}" aria-describedby="${key}-unit">
      <span class="field-label" id="${key}-unit">${unit}</span>
    </div>
  `;
}

function multiSelectDropdown(label, key, selected) {
  const isOpen = openDropdown === key;
  const options = sortedMergedOptions(key, selected);

  return `
    <div class="field dropdown-field${isOpen ? " is-open" : ""}" data-dropdown>
      <span class="field-label">${label}</span>
      <button class="select-trigger" type="button" data-menu-trigger="${key}" aria-expanded="${isOpen}">
        <strong>${escapeHtml(selected.length ? selected.join("、") : "未选择")}</strong>
        <span aria-hidden="true">⌄</span>
      </button>
      <div class="dropdown-menu">
        ${options.map(option => `
          <label class="option-row">
            <input type="checkbox" data-toggle data-key="${key}" data-value="${escapeAttribute(option)}" ${selected.includes(option) ? "checked" : ""}>
            <span>${escapeHtml(option)}</span>
          </label>
        `).join("")}
        <div class="custom-option">
          <input type="text" data-custom-input="${key}" placeholder="添加${label}">
          <button type="button" data-add-custom="${key}" aria-label="添加${label}">＋</button>
        </div>
      </div>
    </div>
  `;
}

function multiSelectList(label, key, selected) {
  const isOpen = openDropdown === key;
  const options = sortedMergedOptions(key, selected);

  return `
    <div class="field dropdown-field${isOpen ? " is-open" : ""}" data-dropdown>
      <span class="field-label">${label}</span>
      <button class="select-trigger" type="button" data-menu-trigger="${key}" aria-expanded="${isOpen}">
        <strong>${escapeHtml(selected.length ? selected.join("、") : "未选择")}</strong>
        <span aria-hidden="true">⌄</span>
      </button>
      <div class="dropdown-menu">
        ${options.map(option => `
          <label class="option-row">
            <input type="checkbox" data-toggle data-key="${key}" data-value="${escapeAttribute(option)}" ${selected.includes(option) ? "checked" : ""}>
            <span>${escapeHtml(option)}</span>
          </label>
        `).join("")}
        <div class="custom-option">
          <input type="text" data-custom-input="${key}" placeholder="添加${label}">
          <button type="button" data-add-custom="${key}" aria-label="添加${label}">＋</button>
        </div>
      </div>
    </div>
  `;
}

function tagSelector(label, key, selected) {
  const options = sortedMergedOptions(key, selected);

  return `
    <div class="tag-editor">
      <div class="tag-editor-head">
        <span class="field-label">${label}</span>
        <span>${selected.length ? `${selected.length} 个已选` : "未选择"}</span>
      </div>
    <div class="chip-grid">
      ${options.map(option => {
        const isConfirmingDelete = isPendingTagDelete(key, option);

        return `
        <span class="chip-shell${isConfirmingDelete ? " is-delete-pending" : ""}">
          <button class="chip${selected.includes(option) ? " is-selected" : ""}" type="button" data-chip-key="${key}" data-chip-value="${escapeAttribute(option)}">
            ${selected.includes(option) ? '<span class="chip-mark" aria-hidden="true">✓</span>' : ""}
            <span>${escapeHtml(option)}</span>
          </button>
          <button class="chip-delete${isConfirmingDelete ? " is-confirming" : ""}" type="button" data-delete-tag-key="${key}" data-delete-tag-value="${escapeAttribute(option)}" aria-label="${isConfirmingDelete ? "确认删除" : "准备删除"}${label}${escapeAttribute(option)}">${isConfirmingDelete ? "确认" : "×"}</button>
        </span>
      `;
      }).join("")}
    </div>
    <div class="tag-add">
      <input type="text" data-custom-input="${key}" placeholder="添加${label}">
      <button class="ghost-button" type="button" data-add-custom="${key}">添加</button>
    </div>
    </div>
  `;
}

function pillGroup(values, emptyLabel, warm = false) {
  if (!values.length) {
    return `<span class="pill${warm ? " is-warm" : ""}">${emptyLabel}</span>`;
  }

  return values.map(value => `<span class="pill${warm ? " is-warm" : ""}">${escapeHtml(value)}</span>`).join("");
}

function filterBaseOptions(key, selected) {
  if (key === "language") {
    return languageOptions;
  }

  if (key === "author") {
    return authorOptions(selected);
  }

  return mergedOptions(key, selected);
}

function authorOptions(selected) {
  const values = [];

  state.books.forEach(book => {
    const author = String(book.author || "").trim();
    if (author && !values.includes(author)) {
      values.push(author);
    }
  });

  ensureArray(selected).forEach(author => {
    if (author && !values.includes(author)) {
      values.push(author);
    }
  });

  return values;
}

function filterValuesForBook(book, group) {
  if (group.key === "author") {
    const author = String(book.author || "").trim();
    return author ? [author] : [];
  }

  if (group.mode === "single") {
    return [book[group.key]];
  }

  return ensureArray(book[group.key]);
}

function mergedOptions(key, selected) {
  const values = [...(state.optionCatalog[key] ?? [])];
  selected.forEach(value => {
    if (!values.includes(value)) values.push(value);
  });
  return values;
}

function sortedMergedOptions(key, selected) {
  return sortedOptionsForKey(key, mergedOptions(key, selected), selected);
}

function sortedOptionsForKey(key, options, selected) {
  const selectedValues = ensureArray(selected);
  const selectedOrder = new Map(selectedValues.map((value, index) => [value, index]));
  const originalOrder = new Map(options.map((value, index) => [value, index]));
  const usageCounts = optionUsageCounts(key);

  return [...options].sort((a, b) => {
    const aSelected = selectedOrder.has(a);
    const bSelected = selectedOrder.has(b);

    if (aSelected !== bSelected) {
      return aSelected ? -1 : 1;
    }

    if (aSelected && bSelected) {
      return selectedOrder.get(a) - selectedOrder.get(b);
    }

    const usageDelta = (usageCounts.get(b) ?? 0) - (usageCounts.get(a) ?? 0);
    if (usageDelta !== 0) {
      return usageDelta;
    }

    return (originalOrder.get(a) ?? 0) - (originalOrder.get(b) ?? 0);
  });
}

function optionUsageCounts(key) {
  const counts = new Map();

  state.books.forEach(book => {
    const values = key === "language" || key === "author" ? [book[key]] : ensureArray(book[key]);
    new Set(values.map(value => String(value || "").trim()).filter(Boolean)).forEach(value => {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    });
  });

  return counts;
}

function formatDecimal(value) {
  return `${Number(value || 0).toFixed(1)}`;
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function clamp(value, min, max) {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
