/**
 * ClipTuck - 後で読むアプリ（完全版）
 * ローカルストレージベースのMVP実装
 * 
 * ✅ アップデート対応版 ✅
 * - この完全版は継続的にアップデートされます
 * - 新機能やUI改善はここに適用されます
 * - 体験版（trial/）は固定版のため変更されません
 * - 現在のバージョン：v1.0.0-full
 * - 最終更新：2024年1月
 */

const MAX_BOOKMARKS = 999999;
const VERSION = 'full';
const VERSION_FULL = 'v1.0.0-full';
const LAST_UPDATED = '2024-01-01';
var STORAGE_KEY = 'cliptuck-data';
var appState = {
    bookmarks: [],
    lastExportAt: null
};

var currentView = 'active';
var filteredBookmarks = [];
var isInitialized = false;

// DOM要素取得ヘルパー
function getDOMElements() {
    return {
        urlInput: document.getElementById('urlInput'),
        titleInput: document.getElementById('titleInput'),
        tagsInput: document.getElementById('tagsInput'),
        descriptionInput: document.getElementById('descriptionInput'),
        searchInput: document.getElementById('searchInput'),
        tagFilter: document.getElementById('tagFilter'),
        domainFilter: document.getElementById('domainFilter'),
        dateFilter: document.getElementById('dateFilter'),
        startDate: document.getElementById('startDate'),
        endDate: document.getElementById('endDate'),
        groupByDomain: document.getElementById('groupByDomain'),
        groupByDate: document.getElementById('groupByDate'),
        bookmarksList: document.getElementById('bookmarksList'),
        status: document.getElementById('status'),
        toast: document.getElementById('toast'),
        editModal: document.getElementById('editModal'),
        editUrlInput: document.getElementById('editUrlInput'),
        editTitleInput: document.getElementById('editTitleInput'),
        editTagsInput: document.getElementById('editTagsInput'),
        editDescriptionInput: document.getElementById('editDescriptionInput'),
        customDateRange: document.getElementById('customDateRange')
    };
}

// 共通更新処理
function updateAllViews() {
    saveData();
    renderBookmarks();
    updateAllFilters();
    updateStatus();
}

// 共通エラーハンドリング
function handleError(error, userMessage, fallbackAction = null) {
    console.error('エラー:', error);
    showToast(userMessage, 'error');
    if (fallbackAction) {
        fallbackAction();
    }
}

// 初期化
function initializeApp() {
    if (!isInitialized) {
        isInitialized = true;
        loadData();
        checkURLParams();
        renderBookmarks();
        updateAllFilters();
        updateStatus();
    }
}

// DOMContentLoadedイベントリスナーを1回だけ追加
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    // DOMContentLoadedが既に発火済みの場合
    initializeApp();
}

// データ読み込み
function loadData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            appState = JSON.parse(stored);
            // データ構造の検証
            if (!Array.isArray(appState.bookmarks)) {
                appState.bookmarks = [];
            }
        }
    } catch (error) {
        handleError(error, 'データの読み込みに失敗しました。新規データで初期化します。', () => {
            appState = { bookmarks: [], lastExportAt: null };
        });
    }
}

// データ保存
function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch (error) {
        handleError(error, 'ストレージ容量が不足しています。古い項目をアーカイブまたは削除してください。');
    }
}

// URL パラメータ処理（ブックマークレット用）
function checkURLParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const addURL = urlParams.get('add');
    const title = urlParams.get('title');
    const tags = urlParams.get('tags');
    const description = urlParams.get('description');
    const popupMode = urlParams.get('popup');
    
    // ブックマークレットからの呼び出しかどうかを確認
    const isFromBookmarklet = addURL && (window.opener || popupMode === '1');
    

    
    if (addURL) {
        console.log('URL パラメータからブックマーク追加:', { addURL, title, tags, description, popupMode, isFromBookmarklet });
        const elements = getDOMElements();
        const { urlInput, titleInput, tagsInput, descriptionInput } = elements;
        
        if (!urlInput || !titleInput) {
            setTimeout(checkURLParams, 100);
            return;
        }
        
        // URL入力欄に設定（エンコードされたまま保存）
        urlInput.value = addURL;
        if (title) {
            titleInput.value = decodeURIComponent(title);
        } else {
            // タイトルが渡されていない場合は、URLからホスト名を自動設定
            try {
                const urlObj = new URL(decodeURIComponent(addURL));
                titleInput.value = urlObj.hostname;
            } catch (e) {
                // URL解析に失敗した場合は空のまま
            }
        }
        
        // タグと説明を設定
        if (tags && tagsInput) {
            tagsInput.value = decodeURIComponent(tags);
        }
        if (description && descriptionInput) {
            descriptionInput.value = decodeURIComponent(description);
        }
        
        // ポップアップモードの場合は自動保存しない
        if (popupMode === '1') {
            // ポップアップモード用のUIを表示
            showPopupMode();
            // URLパラメータをクリア（popupパラメータは残す）
            const newUrl = window.location.pathname + '?popup=1';
            window.history.replaceState({}, document.title, newUrl);
        } else {
            // 通常モードは自動保存
            setTimeout(() => {
                if (urlInput.value.trim()) {
                    addBookmark();
                    // URLパラメータをクリア
                    window.history.replaceState({}, document.title, window.location.pathname);
                }
            }, 100);
        }
    }
}

// ブックマーク追加
function addBookmark() {

    const elements = getDOMElements();
    const { urlInput, titleInput, tagsInput, descriptionInput } = elements;
    
    if (!urlInput) {
        showToast('URL入力欄が見つかりません', 'error');
        return;
    }
    
    let url = urlInput.value.trim();
    

    
    if (!url) {
        showToast('URLを入力してください', 'error');
        return;
    }
    
    // URLをデコードしてから検証
    let originalUrl = url;
    try {
        // URLが既にエンコードされている場合はデコード
        if (url.includes('%')) {
            url = decodeURIComponent(url);
        }
    } catch (e) {
        // デコードに失敗した場合は元のURLを使用
        console.warn('URL decode failed:', e);
        url = originalUrl;
    }
    
    // 簡易URL検証（デコード後）
    if (!url.match(/^https?:\/\/.+/)) {
        showToast('有効なURLを入力してください（http://またはhttps://）', 'error');
        return;
    }
    
    // URLが正常に解析できるかチェック
    try {
        new URL(url);
    } catch (e) {
        showToast('無効なURL形式です', 'error');
        return;
    }
    
    let title = titleInput.value.trim();
    if (!title) {
        // URLからホスト名を抽出
        try {
            const urlObj = new URL(url);
            title = urlObj.hostname;
        } catch (e) {
            title = url;
        }
    }
    
    const tags = tagsInput.value.split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    
    const description = descriptionInput ? descriptionInput.value.trim() : '';
    
    // 重複チェック（同じURLがあれば更新）
    const existingIndex = appState.bookmarks.findIndex(b => b.url === url);
    
    const bookmark = {
        id: existingIndex >= 0 ? appState.bookmarks[existingIndex].id : generateId(),
        url: url,
        title: title,
        tags: tags,
        description: description,
        createdAt: new Date().toISOString(),
        archived: false
    };
    
    if (existingIndex >= 0) {
        appState.bookmarks[existingIndex] = bookmark;
        showToast('ブックマークを更新しました', 'success');

    } else {
        appState.bookmarks.unshift(bookmark);
        showToast('ブックマークを保存しました', 'success');

    }
    
    updateAllViews();
    
    // ブックマークレットからの呼び出しかどうかを判定
    const urlParams = new URLSearchParams(window.location.search);
    const hasAddParam = !!urlParams.get('add');
    const hasOpener = !!window.opener;
    const isPopupMode = urlParams.get('popup') === '1';
    
    // ブックマークレットからの呼び出しの判定
    // 1. ポップアップモード、2. openerあり、3. addとtitleパラメータの組み合わせ
    const isFromBookmarklet = hasAddParam && (
        isPopupMode || 
        hasOpener || 
        (urlParams.get('title') && urlParams.get('add').startsWith('http'))
    );
    
    console.log('ブックマーク保存完了:', {
        isFromBookmarklet,
        hasOpener,
        isPopup: isPopupMode,
        addParam: urlParams.get('add'),
        windowName: window.name,
        hasTitle: !!urlParams.get('title')
    });
    
    // ブックマークレットからの保存完了を通知
    let shouldCloseWindow = false;
    try {
        if (window.opener && !window.opener.closed) {
            // 安全にpostMessageを送信（オリジン制限を緩和）
            window.opener.postMessage({ 
                type: 'bookmarkSaved', 
                success: true, 
                timestamp: Date.now(),
                source: 'ClipTuck'
            }, '*');
            
            // 親ウィンドウが存在する場合はタブを閉じる
            shouldCloseWindow = true;
        }
    } catch (e) {
        console.log('親ウィンドウへの通知に失敗しました:', e);
    }
    
    // ブックマークレットから呼び出された場合はウィンドウを閉じる
    if (isFromBookmarklet) {
        const isPopupMode = urlParams.get('popup') === '1';
        const message = isPopupMode ? '保存しました！ウィンドウを閉じます...' : '保存完了！タブを閉じます...';
        
        showToast(message, 'success');
        setTimeout(() => {
            try {
                console.log('ウィンドウを閉じます...');
                window.close();
                
                // 閉じられなかった場合の追加処理
                setTimeout(() => {
                    if (!window.closed) {
                        console.log('ウィンドウが閉じられませんでした');
                        showToast('手動でタブを閉じてください', 'info');
                        
                        // 最後の手段：ページを空にする
                        setTimeout(() => {
                            document.body.innerHTML = '<div style="text-align:center;padding:50px;"><h2>保存完了！</h2><p>このタブを閉じてください。</p><button onclick="window.close()" style="padding:10px 20px;font-size:16px;">閉じる</button></div>';
                        }, 2000);
                    }
                }, 500);
                
            } catch (e) {
                // ウィンドウが閉じられない場合のフォールバック
                console.log('ウィンドウクローズに失敗:', e);
                showToast('手動でタブを閉じてください', 'info');
            }
        }, isPopupMode ? 1500 : 1000);
    }
    
    // フォームクリア
    urlInput.value = '';
    titleInput.value = '';
    tagsInput.value = '';
    if (descriptionInput) {
        descriptionInput.value = '';
    }
}

// ID生成
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// ブックマークの選択状態を切り替える
function toggleBookmarkSelection(bookmarkId) {
    const isCurrentlySelected = selectedBookmarks.has(bookmarkId);
    
    if (isCurrentlySelected) {
        selectedBookmarks.delete(bookmarkId);
    } else {
        selectedBookmarks.add(bookmarkId);
    }
    
    updateBookmarkSelectionUI(bookmarkId, !isCurrentlySelected);
    updateDeleteSelectedButton();
}

// ギャラリー全体選択管理（統合版）
function toggleAllGallerySelection(selectAll = true) {
    const count = selectAll ? filteredBookmarks.length : selectedBookmarks.size;
    
    if (selectAll) {
        // 全選択
        filteredBookmarks.forEach(bookmark => {
            selectedBookmarks.add(bookmark.id);
            updateBookmarkSelectionUI(bookmark.id, true);
        });
        showToast(`${count}件のギャラリーを選択しました`, 'info');
    } else {
        // 全解除
        selectedBookmarks.clear();
        document.querySelectorAll('.bookmark-item').forEach(item => {
            updateBookmarkSelectionUI(item.dataset.id, false);
        });
        showToast(`${count}件の選択を解除しました`, 'info');
    }
    
    updateDeleteSelectedButton();
}

// 全選択
function selectAllGallery() {
    toggleAllGallerySelection(true);
}

// 全解除  
function deselectAllGallery() {
    toggleAllGallerySelection(false);
}

// ブックマーク選択UI更新ヘルパー
function updateBookmarkSelectionUI(bookmarkId, isSelected) {
    const bookmarkItem = document.querySelector(`[data-id="${bookmarkId}"]`);
    const checkbox = document.querySelector(`#select-${bookmarkId}`);
    
    if (bookmarkItem) {
        bookmarkItem.classList.toggle('selected', isSelected);
    }
    if (checkbox) {
        checkbox.checked = isSelected;
    }
}

// 選択されたブックマークを削除する
function deleteSelectedBookmarks() {
    if (selectedBookmarks.size === 0) {
        return;
    }
    
    const confirmMessage = selectedBookmarks.size === 1 
        ? 'この1件のギャラリーを削除しますか？'
        : `選択した${selectedBookmarks.size}件のギャラリーを削除しますか？`;
    
    if (confirm(confirmMessage)) {
        const deletedCount = selectedBookmarks.size;
        
        // 選択されたブックマークを削除
        appState.bookmarks = appState.bookmarks.filter(b => !selectedBookmarks.has(b.id));
        
        // 選択状態をクリア
        selectedBookmarks.clear();
        
        saveData();
        renderBookmarks();
        updateTagFilter();
        updateStatus();
        
        showToast(`${deletedCount}件のギャラリーを削除しました`, 'success');
    }
}

// 全てのギャラリー（ブックマーク）を削除する
function deleteAllBookmarks() {
    const activeCount = appState.bookmarks.filter(b => !b.archived).length;
    const archivedCount = appState.bookmarks.filter(b => b.archived).length;
    const totalCount = appState.bookmarks.length;
    
    let confirmMessage = '';
    let targetView = '';
    
    if (currentView === 'active' && activeCount > 0) {
        confirmMessage = `⚠️ 危険な操作です！\n\nアクティブな${activeCount}件のギャラリーを全て削除しますか？\n\nこの操作は元に戻せません。`;
        targetView = 'active';
    } else if (currentView === 'archived' && archivedCount > 0) {
        confirmMessage = `⚠️ 危険な操作です！\n\nアーカイブされた${archivedCount}件のギャラリーを全て削除しますか？\n\nこの操作は元に戻せません。`;
        targetView = 'archived';
    } else if (totalCount > 0) {
        confirmMessage = `⚠️ 非常に危険な操作です！\n\n保存されている${totalCount}件のギャラリーを全て削除しますか？\n\nこの操作は元に戻せません。`;
        targetView = 'all';
    } else {
        showToast('削除するギャラリーがありません', 'info');
        return;
    }
    
    // 二重確認
    if (confirm(confirmMessage)) {
        const secondConfirm = confirm('本当によろしいですか？この操作は元に戻すことができません。');
        
        if (secondConfirm) {
            let deletedCount = 0;
            
            if (targetView === 'active') {
                // アクティブなギャラリーのみ削除
                const beforeCount = appState.bookmarks.length;
                appState.bookmarks = appState.bookmarks.filter(b => b.archived);
                deletedCount = beforeCount - appState.bookmarks.length;
            } else if (targetView === 'archived') {
                // アーカイブされたギャラリーのみ削除
                const beforeCount = appState.bookmarks.length;
                appState.bookmarks = appState.bookmarks.filter(b => !b.archived);
                deletedCount = beforeCount - appState.bookmarks.length;
            } else {
                // 全て削除
                deletedCount = appState.bookmarks.length;
                appState.bookmarks = [];
            }
            
            // 選択状態もクリア
            selectedBookmarks.clear();
            
            saveData();
            renderBookmarks();
            updateAllFilters();
            updateStatus();
            
            showToast(`${deletedCount}件のギャラリーを削除しました`, 'success');
        }
    }
}

// 選択削除ボタンの表示/非表示を更新
function updateDeleteSelectedButton() {
    const deleteBtn = document.getElementById('deleteSelectedBtn');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    
    if (deleteBtn) {
        if (selectedBookmarks.size > 0) {
            deleteBtn.style.display = 'inline-block';
            deleteBtn.textContent = `${selectedBookmarks.size}件を削除`;
        } else {
            deleteBtn.style.display = 'none';
        }
    }
    
    // 全選択/全解除ボタンの表示制御
    if (selectAllBtn && deselectAllBtn) {
        const visibleBookmarks = filteredBookmarks.length;
        if (visibleBookmarks > 0) {
            selectAllBtn.style.display = selectedBookmarks.size === visibleBookmarks ? 'none' : 'inline-block';
            deselectAllBtn.style.display = selectedBookmarks.size > 0 ? 'inline-block' : 'none';
        } else {
            selectAllBtn.style.display = 'none';
            deselectAllBtn.style.display = 'none';
        }
    }
}

// ビュー切替時に選択状態をクリア
function switchView() {
    const viewRadios = document.getElementsByName('view');
    for (const radio of viewRadios) {
        if (radio.checked) {
            currentView = radio.value;
            break;
        }
    }
    
    // ビュー切替時に選択状態をクリア
    selectedBookmarks.clear();
    
    renderBookmarks();
    updateStatus();
}

// ブックマーク絞り込み
function filterBookmarks() {
    const elements = getDOMElements();
    const searchTerm = elements.searchInput.value.toLowerCase();
    const tagFilter = elements.tagFilter.value;
    const domainFilter = elements.domainFilter ? elements.domainFilter.value : '';
    const dateFilter = elements.dateFilter ? elements.dateFilter.value : '';
    
    // 期間指定UIの表示制御
    if (elements.customDateRange && elements.dateFilter) {
        elements.customDateRange.style.display = elements.dateFilter.value === 'custom' ? 'block' : 'none';
    }
    
    filteredBookmarks = appState.bookmarks.filter(bookmark => {
        // アーカイブ状態でフィルタ
        if (currentView === 'active' && bookmark.archived) return false;
        if (currentView === 'archived' && !bookmark.archived) return false;
        
        // 検索文字列でフィルタ
        if (searchTerm) {
            const searchableText = (bookmark.title + ' ' + bookmark.url + ' ' + bookmark.tags.join(' ') + ' ' + (bookmark.description || '')).toLowerCase();
            if (!searchableText.includes(searchTerm)) return false;
        }
        
        // タグでフィルタ
        if (tagFilter) {
            if (!bookmark.tags.includes(tagFilter)) return false;
        }
        
        // ドメインでフィルタ
        if (domainFilter) {
            const bookmarkDomain = extractDomain(bookmark.url);
            if (bookmarkDomain !== domainFilter) return false;
        }
        
        // 日付でフィルタ
        if (dateFilter) {
            const bookmarkDate = new Date(bookmark.createdAt);
            const now = new Date();
            
            switch (dateFilter) {
                case 'today':
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    if (bookmarkDate < today) return false;
                    break;
                    
                case 'week':
                    const oneWeekAgo = new Date();
                    oneWeekAgo.setDate(now.getDate() - 7);
                    if (bookmarkDate < oneWeekAgo) return false;
                    break;
                    
                case 'month':
                    const oneMonthAgo = new Date();
                    oneMonthAgo.setMonth(now.getMonth() - 1);
                    if (bookmarkDate < oneMonthAgo) return false;
                    break;
                    
                case 'custom':
                    if (elements.startDate && elements.startDate.value) {
                        const startDate = new Date(elements.startDate.value);
                        if (bookmarkDate < startDate) return false;
                    }
                    if (elements.endDate && elements.endDate.value) {
                        const endDate = new Date(elements.endDate.value);
                        endDate.setHours(23, 59, 59, 999);
                        if (bookmarkDate > endDate) return false;
                    }
                    break;
            }
        }
        
        return true;
    });
    
    renderBookmarksList();
}

// ブックマーク表示
function renderBookmarks() {
    filterBookmarks();
    renderBookmarksList();
}

// 選択状態を管理するグローバル変数
var selectedBookmarks = new Set();

// ブックマーク一覧描画（フィルタリング済み）
function renderBookmarksList() {
    const container = document.getElementById('bookmarksList');
    const elements = getDOMElements();
    
    if (filteredBookmarks.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>${currentView === 'active' ? 'アクティブな' : 'アーカイブされた'}ブックマークがありません</p>
            </div>
        `;
        return;
    }
    
    const groupByDomain = elements.groupByDomain && elements.groupByDomain.checked;
    const groupByDate = elements.groupByDate && elements.groupByDate.checked;
    
    let html = '';
    
    if (groupByDomain && groupByDate) {
        // ドメインと日付の両方でグループ化
        html = renderGroupedByDomainAndDate();
    } else if (groupByDomain) {
        // ドメインのみでグループ化
        html = renderGroupedByDomain();
    } else if (groupByDate) {
        // 日付のみでグループ化
        html = renderGroupedByDate();
    } else {
        // グループ化なし（通常表示）
        html = renderBookmarksFlat();
    }
    
    container.innerHTML = html;
    
    // 選択状態に応じて削除ボタンの表示を更新
    updateDeleteSelectedButton();
}

// フラット表示（グループ化なし）
function renderBookmarksFlat() {
    return filteredBookmarks.map(bookmark => renderSingleBookmark(bookmark)).join('');
}

// ドメインでグループ化した表示
function renderGroupedByDomain() {
    const domainGroups = {};
    
    filteredBookmarks.forEach(bookmark => {
        const domain = extractDomain(bookmark.url);
        if (!domainGroups[domain]) {
            domainGroups[domain] = [];
        }
        domainGroups[domain].push(bookmark);
    });
    
    const sortedDomains = Object.keys(domainGroups).sort();
    
    return sortedDomains.map(domain => {
        const bookmarks = domainGroups[domain];
        const bookmarkCount = bookmarks.length;
        
        return `
            <div class="domain-group">
                <div class="group-header">
                    <h3 class="group-title">🌐 ${escapeHtml(domain)} (${bookmarkCount}件)</h3>
                </div>
                <div class="group-content">
                    ${bookmarks.map(bookmark => renderSingleBookmark(bookmark)).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// 日付でグループ化した表示
function renderGroupedByDate() {
    const dateGroups = {};
    
    filteredBookmarks.forEach(bookmark => {
        const dateKey = formatDateKey(bookmark.createdAt);
        if (!dateGroups[dateKey]) {
            dateGroups[dateKey] = [];
        }
        dateGroups[dateKey].push(bookmark);
    });
    
    const sortedDates = Object.keys(dateGroups).sort().reverse(); // 新しい日付順
    
    return sortedDates.map(dateKey => {
        const bookmarks = dateGroups[dateKey];
        const bookmarkCount = bookmarks.length;
        
        return `
            <div class="date-group">
                <div class="group-header">
                    <h3 class="group-title">📅 ${dateKey} (${bookmarkCount}件)</h3>
                </div>
                <div class="group-content">
                    ${bookmarks.map(bookmark => renderSingleBookmark(bookmark)).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// ドメインと日付の両方でグループ化
function renderGroupedByDomainAndDate() {
    const domainGroups = {};
    
    filteredBookmarks.forEach(bookmark => {
        const domain = extractDomain(bookmark.url);
        if (!domainGroups[domain]) {
            domainGroups[domain] = {};
        }
        
        const dateKey = formatDateKey(bookmark.createdAt);
        if (!domainGroups[domain][dateKey]) {
            domainGroups[domain][dateKey] = [];
        }
        domainGroups[domain][dateKey].push(bookmark);
    });
    
    const sortedDomains = Object.keys(domainGroups).sort();
    
    return sortedDomains.map(domain => {
        const dateGroups = domainGroups[domain];
        const sortedDates = Object.keys(dateGroups).sort().reverse();
        const totalCount = Object.values(dateGroups).reduce((sum, bookmarks) => sum + bookmarks.length, 0);
        
        return `
            <div class="domain-group">
                <div class="group-header">
                    <h3 class="group-title">🌐 ${escapeHtml(domain)} (${totalCount}件)</h3>
                </div>
                <div class="group-content">
                    ${sortedDates.map(dateKey => {
                        const bookmarks = dateGroups[dateKey];
                        return `
                            <div class="date-subgroup">
                                <div class="subgroup-header">
                                    <h4 class="subgroup-title">📅 ${dateKey} (${bookmarks.length}件)</h4>
                                </div>
                                <div class="subgroup-content">
                                    ${bookmarks.map(bookmark => renderSingleBookmark(bookmark)).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

// 単一ブックマークのレンダリング
function renderSingleBookmark(bookmark) {
    const domain = extractDomain(bookmark.url);
    const formattedDate = formatDate(bookmark.createdAt);
    const tagsHtml = bookmark.tags.map(tag => `<span class="tag">${escapeHtml(tag)}</span>`).join('');
    const description = bookmark.description || '';
    const descriptionHtml = description ? `<div class="bookmark-description">${escapeHtml(description)}</div>` : '';
    const isSelected = selectedBookmarks.has(bookmark.id);
    
    return `
        <div class="bookmark-item ${isSelected ? 'selected' : ''}" data-id="${bookmark.id}">
            <div class="bookmark-selector">
                <input type="checkbox" id="select-${bookmark.id}" ${isSelected ? 'checked' : ''} 
                       onchange="toggleBookmarkSelection('${bookmark.id}')">
                <label for="select-${bookmark.id}"></label>
            </div>
            <div class="bookmark-content" onclick="toggleBookmarkSelection('${bookmark.id}')">
                <h3 class="bookmark-title" onclick="event.stopPropagation(); openUrl('${bookmark.url}')">${escapeHtml(bookmark.title)}</h3>
                <div class="bookmark-meta">
                    <span class="bookmark-domain">${escapeHtml(domain)}</span>
                    <span class="bookmark-date">${formattedDate}</span>
                </div>
                ${tagsHtml ? `<div class="bookmark-tags">${tagsHtml}</div>` : ''}
                ${descriptionHtml}
            </div>
            <div class="bookmark-actions">
                <button class="btn-edit" onclick="openEditModal('${bookmark.id}')" title="編集">✏️</button>
                <button class="btn-archive" onclick="toggleArchive('${bookmark.id}')" title="${bookmark.archived ? 'アンアーカイブ' : 'アーカイブ'}">
                    ${bookmark.archived ? '📂' : '📁'}
                </button>
                <button class="btn-delete" onclick="deleteBookmark('${bookmark.id}')" title="削除">🗑️</button>
            </div>
        </div>
    `;
}

// 日付キーのフォーマット（グルーピング用）
function formatDateKey(isoString) {
    const date = new Date(isoString);
    return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// ドメイン抽出
function extractDomain(url) {
    try {
        return new URL(url).hostname;
    } catch (e) {
        return url;
    }
}

// 日付フォーマット
function formatDate(isoString) {
    const date = new Date(isoString);
    return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// HTML エスケープ
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// URL を新規タブで開く
function openUrl(url) {
    window.open(url, '_blank');
}

// アーカイブ切替
function toggleArchive(id) {
    const bookmark = appState.bookmarks.find(b => b.id === id);
    if (bookmark) {
        bookmark.archived = !bookmark.archived;
        updateAllViews();
        showToast(bookmark.archived ? 'アーカイブしました' : 'アンアーカイブしました', 'success');
    }
}

// ブックマーク削除
function deleteBookmark(id) {
    if (confirm('このブックマークを削除しますか？')) {
        appState.bookmarks = appState.bookmarks.filter(b => b.id !== id);
        saveData();
        renderBookmarks();
        updateTagFilter();
        updateStatus();
        showToast('削除しました', 'success');
    }
}

// タグフィルター更新
function updateTagFilter() {
    const tagFilter = document.getElementById('tagFilter');
    const allTags = new Set();
    
    appState.bookmarks.forEach(bookmark => {
        bookmark.tags.forEach(tag => allTags.add(tag));
    });
    
    const sortedTags = Array.from(allTags).sort();
    const currentValue = tagFilter.value;
    
    tagFilter.innerHTML = '<option value="">すべてのタグ</option>' +
        sortedTags.map(tag => `<option value="${escapeHtml(tag)}">${escapeHtml(tag)}</option>`).join('');
    
    // 現在の選択値を復元
    if (sortedTags.includes(currentValue)) {
        tagFilter.value = currentValue;
    }
}

// ドメインフィルター更新
function updateDomainFilter() {
    const domainFilter = document.getElementById('domainFilter');
    if (!domainFilter) return;
    
    const domainCounts = {};
    
    appState.bookmarks.forEach(bookmark => {
        const domain = extractDomain(bookmark.url);
        domainCounts[domain] = (domainCounts[domain] || 0) + 1;
    });
    
    const sortedDomains = Object.keys(domainCounts).sort();
    const currentValue = domainFilter.value;
    
    domainFilter.innerHTML = '<option value="">すべてのドメイン</option>' +
        sortedDomains.map(domain => 
            `<option value="${escapeHtml(domain)}">${escapeHtml(domain)} (${domainCounts[domain]})</option>`
        ).join('');
    
    // 現在の選択値を復元
    if (sortedDomains.includes(currentValue)) {
        domainFilter.value = currentValue;
    }
}

// すべてのフィルターを更新
function updateAllFilters() {
    updateTagFilter();
    updateDomainFilter();
}

// ステータス更新
function updateStatus() {
    const activeCount = appState.bookmarks.filter(b => !b.archived).length;
    const archivedCount = appState.bookmarks.filter(b => b.archived).length;
    const filteredCount = filteredBookmarks.length;
    
    document.getElementById('status').textContent = 
        `アクティブ: ${activeCount}件, アーカイブ: ${archivedCount}件, 表示中: ${filteredCount}件`;
}

// ブックマークレット表示切替
function toggleBookmarklet() {
    const section = document.getElementById('bookmarkletSection');
    section.style.display = section.style.display === 'none' ? 'block' : 'none';
    
    // ブックマークレットを動的に生成
    if (section.style.display === 'block') {
        generateBookmarklet();
    }
}

// ブックマークレット生成
function generateBookmarklet() {
    const bookmarkletLink = document.getElementById('bookmarkletLink');
    const popupBookmarkletLink = document.getElementById('popupBookmarkletLink');
    const currentBase = window.location.origin + window.location.pathname;
    
    // 改良されたシンプルなブックマークレット
    const bookmarkletCode = `javascript:(function(){
var currentUrl=encodeURIComponent(window.location.href);
var currentTitle=encodeURIComponent(document.title);
var base='${currentBase}';
try{
var newTab=window.open(base+'?add='+currentUrl+'&title='+currentTitle,'ClipTuck_'+Date.now(),'width=800,height=600');
if(!newTab){
alert('ポップアップがブロックされました。ポップアップを許可してください。');
return;
}
var messageHandler=function(e){
if(e.data&&e.data.type==='bookmarkSaved'&&e.data.success){
if(newTab&&!newTab.closed){
newTab.close();
}
window.removeEventListener('message',messageHandler);
}
};
window.addEventListener('message',messageHandler,false);
var timeout=setTimeout(function(){
if(newTab&&!newTab.closed){
newTab.close();
}
window.removeEventListener('message',messageHandler);
},10000);
}catch(e){
console.error('ブックマークレットエラー:',e);
alert('保存に失敗しました: '+e.message);
}
})();`;
    
    // ポップアップ付きブックマークレット
    const popupBookmarkletCode = generatePopupBookmarkletCode(currentBase);
    
    bookmarkletLink.href = bookmarkletCode;
    popupBookmarkletLink.href = popupBookmarkletCode;
}

// ポップアップ付きブックマークレットコード生成
function generatePopupBookmarkletCode(base) {
    // 外部サイト対応：新しいタブでポップアップを表示する方式
    const popupScript = `(function(){
var currentUrl=encodeURIComponent(window.location.href);
var currentTitle=encodeURIComponent(document.title);
var base='${base}';
var popupUrl=base+'?popup=1&add='+currentUrl+'&title='+currentTitle;

try{
var newTab=window.open(popupUrl,'ClipTuck_popup_'+Date.now(),'width=500,height=600,scrollbars=yes,resizable=yes');
if(newTab){
newTab.focus();
var messageHandler=function(e){
if(e.data&&e.data.type==='bookmarkSaved'&&e.data.success){
if(newTab&&!newTab.closed){
newTab.close();
}
window.removeEventListener('message',messageHandler);
}
};
window.addEventListener('message',messageHandler,false);
var timeout=setTimeout(function(){
if(newTab&&!newTab.closed){
newTab.close();
}
window.removeEventListener('message',messageHandler);
},30000);
}else{
alert('ポップアップがブロックされました。ポップアップを許可してください。');
}
}catch(e){
console.error('ブックマークレットエラー:',e);
alert('保存に失敗しました: '+e.message);
}
})();`;
    
    return `javascript:${popupScript}`;
}

// ポップアップモード表示
function showPopupMode() {
    // ページタイトルを変更
    document.title = '📚 ClipTuckに保存';
    
    // ヘッダーを簡潔に
    const header = document.querySelector('.header');
    if (header) {
        header.innerHTML = '<h2 style="margin:0;color:#007bff;">📚 ブックマーク保存</h2>';
    }
    
    // 不要な要素を非表示
    const controls = document.querySelector('.controls .filters');
    const dataControls = document.querySelector('.data-controls');
    const bookmarksList = document.querySelector('.bookmarks-list');
    const status = document.querySelector('.status');
    
    if (controls) controls.style.display = 'none';
    if (dataControls) dataControls.style.display = 'none';
    if (bookmarksList) bookmarksList.style.display = 'none';
    if (status) status.style.display = 'none';
    
    // エクスポート・インポートボタンを非表示
    const exportButton = document.querySelector('button[onclick="exportData()"]');
    const importLabel = document.querySelector('label.file-label');
    
    if (exportButton) exportButton.style.display = 'none';
    if (importLabel) importLabel.style.display = 'none';
    
    // フォームを目立たせる
    const addForm = document.querySelector('.add-form');
    if (addForm) {
        addForm.style.background = 'white';
        addForm.style.padding = '20px';
        addForm.style.borderRadius = '8px';
        addForm.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
        addForm.style.margin = '20px 0';
    }
    
    // 保存ボタンを目立たせる
    const saveButton = addForm?.querySelector('button');
    if (saveButton) {
        saveButton.textContent = '保存して閉じる';
        saveButton.style.background = '#28a745';
        saveButton.style.padding = '12px 24px';
        saveButton.style.fontSize = '16px';
    }
    
    // キャンセルボタンを追加
    if (saveButton && !document.getElementById('cancelButton')) {
        const cancelButton = document.createElement('button');
        cancelButton.id = 'cancelButton';
        cancelButton.type = 'button';
        cancelButton.textContent = 'キャンセル';
        cancelButton.style.cssText = 'background:#6c757d;color:white;border:none;padding:12px 24px;margin-right:12px;border-radius:4px;cursor:pointer;font-size:16px';
        cancelButton.onclick = function() {
            window.close();
        };
        saveButton.parentNode.insertBefore(cancelButton, saveButton);
    }
    
    // タグフィールドにフォーカス
    const tagsInput = document.getElementById('tagsInput');
    if (tagsInput) {
        setTimeout(() => {
            tagsInput.focus();
        }, 100);
    }
}

// データエクスポート
function exportData() {
    try {
        appState.lastExportAt = new Date().toISOString();
        const dataStr = JSON.stringify(appState, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `cliptuck-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        saveData();
        showToast('エクスポートしました', 'success');
    } catch (error) {
        handleError(error, 'エクスポートに失敗しました');
    }
}

// データインポート
function importData() {
    const file = document.getElementById('importFile').files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedData = JSON.parse(e.target.result);
            
            // データ構造の検証
            if (!importedData.bookmarks || !Array.isArray(importedData.bookmarks)) {
                throw new Error('無効なファイル形式です');
            }
            
            // マージ処理（IDの重複は既存優先）
            const existingIds = new Set(appState.bookmarks.map(b => b.id));
            const newBookmarks = importedData.bookmarks.filter(b => !existingIds.has(b.id));
            
            appState.bookmarks.push(...newBookmarks);
            
            // 日付でソート
            appState.bookmarks.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            saveData();
            renderBookmarks();
            updateAllFilters();
            updateStatus();
            
            showToast(`${newBookmarks.length}件のブックマークをインポートしました`, 'success');
        } catch (error) {
            handleError(error, 'インポートに失敗しました: ' + error.message);
        }
    };
    reader.readAsText(file);
    
    // ファイル選択をクリア
    document.getElementById('importFile').value = '';
}

// トースト通知
function showToast(message, type = 'info') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// 編集機能
var currentEditingId = null;

// 編集モーダルを開く
function openEditModal(bookmarkId) {
    const bookmark = appState.bookmarks.find(b => b.id === bookmarkId);
    if (!bookmark) return;
    
    currentEditingId = bookmarkId;
    
    // フォームに現在の値を設定
    document.getElementById('editUrlInput').value = bookmark.url;
    document.getElementById('editTitleInput').value = bookmark.title;
    document.getElementById('editTagsInput').value = bookmark.tags.join(', ');
    document.getElementById('editDescriptionInput').value = bookmark.description || '';
    
    // モーダル表示
    document.getElementById('editModal').style.display = 'flex';
}

// 編集モーダルを閉じる
function closeEditModal() {
    document.getElementById('editModal').style.display = 'none';
    currentEditingId = null;
}

// ヘルプモーダルを表示
function showHelpModal() {
    document.getElementById('helpModal').style.display = 'flex';
}

// ヘルプモーダルを閉じる
function closeHelpModal() {
    document.getElementById('helpModal').style.display = 'none';
}

// モーダルの背景クリックで閉じる
document.addEventListener('click', function(e) {
    const editModal = document.getElementById('editModal');
    const helpModal = document.getElementById('helpModal');
    
    if (e.target === editModal) {
        closeEditModal();
    }
    if (e.target === helpModal) {
        closeHelpModal();
    }
});

// 編集内容を保存
function saveEdit() {
    if (!currentEditingId) return;
    
    const bookmark = appState.bookmarks.find(b => b.id === currentEditingId);
    if (!bookmark) return;
    
    const editUrl = document.getElementById('editUrlInput').value.trim();
    const editTitle = document.getElementById('editTitleInput').value.trim();
    const editTags = document.getElementById('editTagsInput').value.split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
    const editDescription = document.getElementById('editDescriptionInput').value.trim();
    
    if (!editUrl) {
        showToast('URLを入力してください', 'error');
        return;
    }
    
    // URL検証
    if (!editUrl.match(/^https?:\/\/.+/)) {
        showToast('有効なURLを入力してください（http://またはhttps://）', 'error');
        return;
    }
    
    // ブックマーク更新
    bookmark.url = editUrl;
    bookmark.title = editTitle || extractDomain(editUrl);
    bookmark.tags = editTags;
    bookmark.description = editDescription;
    bookmark.updatedAt = new Date().toISOString();
    
    updateAllViews();
    closeEditModal();
    
    showToast('ブックマークを更新しました', 'success');
}

// キーボードショートカット
document.addEventListener('keydown', function(e) {
    // Ctrl+S または Cmd+S でブックマーク保存
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        addBookmark();
    }
    
    // ESC でブックマークレット非表示、モーダル閉じる
    if (e.key === 'Escape') {
        document.getElementById('bookmarkletSection').style.display = 'none';
        if (document.getElementById('editModal').style.display === 'flex') {
            closeEditModal();
        }
        if (document.getElementById('helpModal').style.display === 'flex') {
            closeHelpModal();
        }
    }
});