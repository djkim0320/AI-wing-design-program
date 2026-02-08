/**
 * 메인 애플리케이션 초기화
 */

const AppState = {
    currentSnapshot: null,
    designRunId: 0
};

const HistoryUI = {
    modal: null,
    overlay: null,
    list: null,
    nameInput: null,
    compareBtn: null,
    clearCompareBtn: null,
    compareStatus: null,
    compareResult: null,
    compareSelection: [],
    items: []
};

const ProviderUI = {
    modal: null,
    overlay: null,
    openBtn: null,
    closeBtn: null,
    saveBtn: null,
    refreshBtn: null,
    providerSelect: null,
    modelSelect: null,
    stateText: null,
    badge: null,
    inputs: {},
    keyStatusEls: {},
    pendingClearProviders: new Set(),
    state: null
};

const DialogUI = {
    modal: null,
    overlay: null,
    title: null,
    message: null,
    input: null,
    okBtn: null,
    cancelBtn: null,
    mode: 'alert',
    resolver: null
};

const PROVIDER_LABELS = {
    gemini: 'Gemini',
    openai: 'GPT',
    anthropic: 'Claude',
    grok: 'Grok'
};

document.addEventListener('DOMContentLoaded', () => {
    initDialogUI();

    // 모듈 초기화
    AirfoilViewer.init();

    // 채팅 초기화 (설계 완료 콜백 전달)
    Chat.init(handleDesignComplete);

    // 탭 전환
    initTabs();

    // 버튼 이벤트
    initButtons();

    // 히스토리 UI 초기화
    initHistoryUI();

    // AI 제공자 설정 UI 초기화
    initProviderUI();

    console.log('Wing Designer AI 초기화 완료');
});

function initDialogUI() {
    DialogUI.modal = document.getElementById('appDialogModal');
    DialogUI.overlay = document.getElementById('appDialogOverlay');
    DialogUI.title = document.getElementById('appDialogTitle');
    DialogUI.message = document.getElementById('appDialogMessage');
    DialogUI.input = document.getElementById('appDialogInput');
    DialogUI.okBtn = document.getElementById('appDialogOkBtn');
    DialogUI.cancelBtn = document.getElementById('appDialogCancelBtn');

    if (!DialogUI.modal) return;

    DialogUI.okBtn?.addEventListener('click', () => resolveDialogByAction('ok'));
    DialogUI.cancelBtn?.addEventListener('click', () => resolveDialogByAction('cancel'));
    DialogUI.overlay?.addEventListener('click', () => {
        if (DialogUI.mode === 'alert') {
            resolveDialogByAction('ok');
        } else {
            resolveDialogByAction('cancel');
        }
    });

    document.addEventListener('keydown', (event) => {
        if (!DialogUI.modal?.classList.contains('open')) return;

        if (event.key === 'Escape') {
            event.preventDefault();
            resolveDialogByAction(DialogUI.mode === 'alert' ? 'ok' : 'cancel');
        }

        if (event.key === 'Enter') {
            if (DialogUI.mode === 'prompt' && document.activeElement === DialogUI.input) {
                event.preventDefault();
                resolveDialogByAction('ok');
                return;
            }
            if (DialogUI.mode !== 'prompt') {
                event.preventDefault();
                resolveDialogByAction('ok');
            }
        }
    });
}

function openDialog(options = {}) {
    if (!DialogUI.modal || !DialogUI.title || !DialogUI.message || !DialogUI.okBtn || !DialogUI.cancelBtn || !DialogUI.input) {
        return Promise.resolve(options.mode === 'confirm' ? false : null);
    }

    const mode = options.mode || 'alert';
    DialogUI.mode = mode;

    DialogUI.title.textContent = String(options.title || '알림');
    DialogUI.message.textContent = String(options.message || '');
    DialogUI.okBtn.textContent = String(options.okText || '확인');
    DialogUI.cancelBtn.textContent = String(options.cancelText || '취소');

    if (mode === 'prompt') {
        DialogUI.input.style.display = 'block';
        DialogUI.input.placeholder = String(options.placeholder || '');
        DialogUI.input.value = String(options.value || '');
    } else {
        DialogUI.input.style.display = 'none';
        DialogUI.input.value = '';
    }

    DialogUI.cancelBtn.style.display = mode === 'alert' ? 'none' : 'inline-flex';
    DialogUI.modal.classList.add('open');

    if (mode === 'prompt') {
        setTimeout(() => {
            DialogUI.input.focus();
            DialogUI.input.select();
        }, 0);
    } else {
        setTimeout(() => {
            DialogUI.okBtn.focus();
        }, 0);
    }

    return new Promise(resolve => {
        DialogUI.resolver = resolve;
    });
}

function resolveDialogByAction(action) {
    if (!DialogUI.modal?.classList.contains('open')) return;

    const resolver = DialogUI.resolver;
    const mode = DialogUI.mode;
    const inputValue = DialogUI.input ? DialogUI.input.value : '';

    DialogUI.modal.classList.remove('open');
    DialogUI.resolver = null;

    if (!resolver) return;

    if (mode === 'alert') {
        resolver(true);
        return;
    }

    if (mode === 'confirm') {
        resolver(action === 'ok');
        return;
    }

    if (mode === 'prompt') {
        resolver(action === 'ok' ? inputValue : null);
    }
}

function appAlert(message, title = '알림') {
    return openDialog({
        mode: 'alert',
        title,
        message,
        okText: '확인'
    });
}

function appConfirm(message, title = '확인') {
    return openDialog({
        mode: 'confirm',
        title,
        message,
        okText: '확인',
        cancelText: '취소'
    });
}

function appPrompt(message, options = {}) {
    return openDialog({
        mode: 'prompt',
        title: options.title || '입력',
        message,
        placeholder: options.placeholder || '',
        value: options.value || '',
        okText: options.okText || '확인',
        cancelText: options.cancelText || '취소'
    });
}

/**
 * 레이놀즈 수 계산
 * Re = (ρ * V * L) / μ ≈ V * L / ν
 * 표준 대기 조건: ν ≈ 1.48e-5 m²/s
 */
function calculateReynolds(chordLength, velocity = 15) {
    const kinematicViscosity = 1.48e-5; // m²/s (20°C, 해수면)
    return Math.round((velocity * chordLength) / kinematicViscosity);
}

function toNumber(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value;
    }
    if (typeof value === 'string') {
        const match = value.trim().match(/-?\d+(\.\d+)?/);
        if (match) {
            const parsed = Number(match[0]);
            if (Number.isFinite(parsed)) return parsed;
        }
    }
    return fallback;
}

function toLengthMeters(value, fallback) {
    if (typeof value === 'string') {
        const s = value.trim().toLowerCase();
        const match = s.match(/-?\d+(\.\d+)?/);
        if (!match) return fallback;

        const num = Number(match[0]);
        if (!Number.isFinite(num)) return fallback;

        if (s.includes('mm')) return num / 1000;
        if (s.includes('cm')) return num / 100;
        if (s.includes('inch') || s.endsWith('in') || s.includes(' in')) return num * 0.0254;
        return num;
    }

    return toNumber(value, fallback);
}

function normalizeAirfoilCode(value, fallback = '2412') {
    const code = String(value ?? '').replace(/[^0-9]/g, '');
    if (code.length === 4 || code.length === 5) {
        return code;
    }
    return fallback;
}

function normalizeDesignData(incomingDesignData) {
    if (!incomingDesignData || typeof incomingDesignData !== 'object') {
        return null;
    }

    const base = AppState.currentSnapshot?.design_data || {};
    const merged = { ...base, ...incomingDesignData };

    const baseAirfoil = base.airfoil || {};
    const incomingAirfoil = incomingDesignData.airfoil || {};
    const mergedAirfoil = { ...baseAirfoil, ...incomingAirfoil };
    const airfoilCode = normalizeAirfoilCode(mergedAirfoil.code, normalizeAirfoilCode(baseAirfoil.code, '2412'));

    const baseWing = base.wing || {};
    const incomingWing = incomingDesignData.wing || {};
    const mergedWing = { ...baseWing, ...incomingWing };

    let span = toLengthMeters(mergedWing.span, toLengthMeters(baseWing.span, 0.8));
    let rootChord = toLengthMeters(mergedWing.root_chord, toLengthMeters(baseWing.root_chord, 0.12));
    let tipChord = toLengthMeters(mergedWing.tip_chord, toLengthMeters(baseWing.tip_chord, 0.08));
    const sweepAngle = toNumber(mergedWing.sweep_angle, toNumber(baseWing.sweep_angle, 0));
    const dihedralAngle = toNumber(mergedWing.dihedral_angle, toNumber(baseWing.dihedral_angle, 3));

    if (!(span > 0)) span = 0.8;
    if (!(rootChord > 0)) rootChord = 0.12;
    if (!(tipChord > 0)) tipChord = Math.max(0.03, rootChord * 0.7);
    span = Math.min(Math.max(span, 0.1), 10);
    rootChord = Math.min(Math.max(rootChord, 0.01), 5);
    tipChord = Math.min(Math.max(tipChord, 0.01), 5);

    return {
        ...merged,
        design_complete: true,
        airfoil: {
            ...mergedAirfoil,
            type: mergedAirfoil.type || 'NACA',
            code: airfoilCode
        },
        wing: {
            ...mergedWing,
            span,
            root_chord: rootChord,
            tip_chord: tipChord,
            sweep_angle: sweepAngle,
            dihedral_angle: dihedralAngle
        },
        reasoning: String(incomingDesignData.reasoning || base.reasoning || merged.reasoning || '')
    };
}

async function generateAirfoilData(designData) {
    if (!designData?.airfoil?.code) return null;

    const response = await fetch('/api/generate-airfoil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code: designData.airfoil.code,
            points: 100
        })
    });

    const airfoilData = await response.json();
    if (airfoilData.error) {
        throw new Error(airfoilData.error);
    }
    return airfoilData;
}

async function generateWingData(designData) {
    if (!designData?.wing) return null;

    const wingParams = {
        airfoil_code: designData.airfoil?.code || '2412',
        span: designData.wing.span || 2.0,
        root_chord: designData.wing.root_chord || 0.3,
        tip_chord: designData.wing.tip_chord || 0.15,
        sweep_angle: designData.wing.sweep_angle || 0,
        dihedral_angle: designData.wing.dihedral_angle || 0
    };

    const response = await fetch('/api/design-wing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(wingParams)
    });

    const wingData = await response.json();
    if (wingData.error) {
        throw new Error(wingData.error);
    }
    return wingData;
}

async function persistCurrentSnapshot(options = {}) {
    if (!AppState.currentSnapshot?.design_data) {
        return null;
    }

    try {
        const response = await fetch('/api/save-design', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ...AppState.currentSnapshot,
                auto_history: options.autoHistory === true,
                history_name: options.historyName || null
            })
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        return data;
    } catch (error) {
        console.error('설계 데이터 저장 실패:', error);
        if (options.throwOnError) {
            throw error;
        }
        return null;
    }
}

async function saveCurrentDesignWithName() {
    if (!AppState.currentSnapshot?.design_data) {
        await appAlert('저장할 설계가 없습니다. 먼저 설계를 완료해 주세요.');
        return;
    }

    const input = await appPrompt('저장할 이름을 입력하세요.', {
        title: '이름 저장',
        placeholder: '예: 글라이더 v2'
    });
    if (input === null) return;

    const name = input.trim();
    if (!name) {
        await appAlert('이름을 입력해 주세요.');
        return;
    }

    try {
        await persistCurrentSnapshot({
            autoHistory: true,
            historyName: name,
            throwOnError: true
        });
        await appAlert('이름을 지정해 저장했습니다.');
        if (HistoryUI.modal?.classList.contains('open')) {
            await refreshHistoryList();
        }
    } catch (error) {
        await appAlert(`저장 실패: ${error.message}`);
    }
}

function clearDesignOutputs() {
    Viewer3D.clear();
    AirfoilViewer.clear();

    if (typeof AeroChart !== 'undefined') {
        AeroChart.clear();
    }

    const specsContainer = document.getElementById('specsContainer');
    if (specsContainer) {
        specsContainer.innerHTML = '<div class="spec-placeholder"><p>날개 설계가 완료되면 상세 제원이 표시됩니다.</p></div>';
    }

    AppState.currentSnapshot = null;
}

/**
 * 설계 완료 시 호출되는 콜백
 */
async function handleDesignComplete(designData, options = {}) {
    const normalizedDesignData = normalizeDesignData(designData);
    if (!normalizedDesignData) return;

    const mergedOptions = {
        snapshot: null,
        optimization: null,
        skipPersist: false,
        autoHistory: true,
        ...options
    };
    const runId = ++AppState.designRunId;
    const isStaleRun = () => runId !== AppState.designRunId;

    console.log('설계 완료:', normalizedDesignData);

    let airfoilData = mergedOptions.snapshot?.airfoil_data || null;
    let wingData = mergedOptions.snapshot?.wing_data || null;
    let aeroData = mergedOptions.snapshot?.aero_data || null;

    // 에어포일 생성 또는 복원
    if (!airfoilData) {
        try {
            airfoilData = await generateAirfoilData(normalizedDesignData);
            if (isStaleRun()) return;
        } catch (error) {
            console.error('에어포일 생성 오류:', error);
        }
    }

    if (airfoilData && !isStaleRun()) {
        const chordLength = normalizedDesignData.wing?.root_chord || 0.07;
        AirfoilViewer.setChordLength(chordLength);
        AirfoilViewer.draw(airfoilData);
        AirfoilViewer.updateInfo(airfoilData);
    }

    // 날개 3D 모델 생성 또는 복원
    if (!wingData) {
        try {
            wingData = await generateWingData(normalizedDesignData);
            if (isStaleRun()) return;
        } catch (error) {
            console.error('날개 설계 오류:', error);
        }
    }

    if (wingData?.mesh && !isStaleRun()) {
        Viewer3D.init();
        Viewer3D.createWingMesh(wingData.mesh);
        updateSpecs(wingData.stats, normalizedDesignData);
        switchTab('3d');

        // 공기역학 성능 분석 생성 또는 복원
        if (typeof AeroChart !== 'undefined') {
            AeroChart.init();

            if (aeroData?.alpha && aeroData?.CL && aeroData?.CD) {
                AeroChart.render(aeroData);
            } else {
                const reynolds = calculateReynolds(wingData.stats.mean_chord, 15);
                aeroData = await AeroChart.analyze(normalizedDesignData.airfoil?.code || '2412', reynolds);
                if (isStaleRun()) return;
            }
        }
    } else if (!isStaleRun()) {
        Viewer3D.clear();
    }

    if (isStaleRun()) return;

    AppState.currentSnapshot = {
        design_data: normalizedDesignData,
        airfoil_data: airfoilData,
        wing_data: wingData,
        aero_data: aeroData,
        optimization: mergedOptions.optimization || mergedOptions.snapshot?.optimization || null
    };

    if (!mergedOptions.skipPersist) {
        await persistCurrentSnapshot({ autoHistory: mergedOptions.autoHistory });
    }
}

/**
 * 제원 정보 업데이트
 */
function updateSpecs(stats, designData) {
    const container = document.getElementById('specsContainer');
    if (!container) return;
    const safeReasoningHtml = designData.reasoning
        ? escapeHtml(String(designData.reasoning)).replace(/\n/g, '<br>')
        : '';

    container.innerHTML = `
        <div class="specs-grid">
            <div class="spec-card">
                <h4>에어포일</h4>
                <div class="value">NACA ${designData.airfoil?.code || '-'}</div>
            </div>
            <div class="spec-card">
                <h4>날개폭 (Span)</h4>
                <div class="value">${stats.span?.toFixed(2) || '-'}<span class="unit">m</span></div>
            </div>
            <div class="spec-card">
                <h4>루트 시위</h4>
                <div class="value">${stats.root_chord?.toFixed(3) || '-'}<span class="unit">m</span></div>
            </div>
            <div class="spec-card">
                <h4>팁 시위</h4>
                <div class="value">${stats.tip_chord?.toFixed(3) || '-'}<span class="unit">m</span></div>
            </div>
            <div class="spec-card">
                <h4>테이퍼비</h4>
                <div class="value">${stats.taper_ratio?.toFixed(2) || '-'}</div>
            </div>
            <div class="spec-card">
                <h4>가로세로비 (AR)</h4>
                <div class="value">${stats.aspect_ratio?.toFixed(2) || '-'}</div>
            </div>
            <div class="spec-card">
                <h4>날개 면적</h4>
                <div class="value">${stats.wing_area?.toFixed(3) || '-'}<span class="unit">m²</span></div>
            </div>
            <div class="spec-card">
                <h4>평균 시위</h4>
                <div class="value">${stats.mean_chord?.toFixed(3) || '-'}<span class="unit">m</span></div>
            </div>
        </div>

        ${safeReasoningHtml ? `
        <div style="margin-top: 1.5rem; padding: 1rem; background: rgba(59, 130, 246, 0.1); border-radius: 0.5rem; border: 1px solid rgba(59, 130, 246, 0.2);">
            <h4 style="font-size: 0.85rem; color: #94a3b8; margin-bottom: 0.5rem;">설계 근거</h4>
            <p style="font-size: 0.9rem; line-height: 1.6; color: #f1f5f9;">${safeReasoningHtml}</p>
        </div>
        ` : ''}
    `;
}

/**
 * 탭 전환 초기화
 */
function initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.dataset.tab;
            switchTab(tabId);
        });
    });
}

function switchTab(tabId) {
    // 버튼 활성화 상태 변경
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // 탭 컨텐츠 표시/숨김
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const tabMap = {
        '3d': 'tab3d',
        'airfoil': 'tabAirfoil',
        'specs': 'tabSpecs'
    };

    const targetTab = document.getElementById(tabMap[tabId]);
    if (targetTab) {
        targetTab.classList.add('active');

        // 3D 뷰어 리사이즈 트리거
        if (tabId === '3d' && Viewer3D.isInitialized) {
            Viewer3D.onResize();
        }

        // 에어포일 캔버스 리사이즈
        if (tabId === 'airfoil') {
            AirfoilViewer.resize();
        }
    }
}

/**
 * 버튼 이벤트 초기화
 */
function initButtons() {
    // 이름 저장 버튼
    document.getElementById('saveNamedBtn')?.addEventListener('click', async () => {
        await saveCurrentDesignWithName();
    });

    // 새 설계 버튼
    document.getElementById('resetBtn')?.addEventListener('click', async () => {
        if (await appConfirm('현재 설계를 초기화하시겠습니까?')) {
            await Chat.reset();
            clearDesignOutputs();
        }
    });

    // 뷰 초기화 버튼
    document.getElementById('resetViewBtn')?.addEventListener('click', () => {
        Viewer3D.resetView();
    });

    // STL 내보내기 버튼
    document.getElementById('exportSTLBtn')?.addEventListener('click', async () => {
        const mesh = Viewer3D.getMesh();
        if (mesh) {
            Exporter.exportSTL(mesh, 'wing_design.stl');
        } else {
            await appAlert('내보낼 날개 모델이 없습니다.');
        }
    });

    // OBJ 내보내기 버튼
    document.getElementById('exportOBJBtn')?.addEventListener('click', async () => {
        const mesh = Viewer3D.getMesh();
        if (mesh) {
            Exporter.exportOBJ(mesh, 'wing_design.obj');
        } else {
            await appAlert('내보낼 날개 모델이 없습니다.');
        }
    });
}

function initProviderUI() {
    ProviderUI.modal = document.getElementById('providerModal');
    ProviderUI.overlay = document.getElementById('providerOverlay');
    ProviderUI.openBtn = document.getElementById('providerSettingsBtn');
    ProviderUI.closeBtn = document.getElementById('closeProviderBtn');
    ProviderUI.saveBtn = document.getElementById('saveProviderBtn');
    ProviderUI.refreshBtn = document.getElementById('refreshProviderBtn');
    ProviderUI.providerSelect = document.getElementById('assistantProviderSelect');
    ProviderUI.modelSelect = document.getElementById('assistantModelSelect');
    ProviderUI.stateText = document.getElementById('providerStateText');
    ProviderUI.badge = document.getElementById('assistantModelBadge');
    ProviderUI.inputs = {
        gemini: document.getElementById('geminiApiKeyInput'),
        openai: document.getElementById('openaiApiKeyInput'),
        anthropic: document.getElementById('anthropicApiKeyInput'),
        grok: document.getElementById('grokApiKeyInput')
    };
    ProviderUI.keyStatusEls = {
        gemini: document.getElementById('geminiKeyStatus'),
        openai: document.getElementById('openaiKeyStatus'),
        anthropic: document.getElementById('anthropicKeyStatus'),
        grok: document.getElementById('grokKeyStatus')
    };

    if (!ProviderUI.modal) {
        return;
    }

    ProviderUI.openBtn?.addEventListener('click', async () => {
        setProviderModalOpen(true);
        try {
            await refreshProviderState();
        } catch (error) {
            await appAlert(`AI 설정 상태를 불러오지 못했습니다: ${error.message}`);
        }
    });
    ProviderUI.closeBtn?.addEventListener('click', () => {
        setProviderModalOpen(false);
    });
    ProviderUI.overlay?.addEventListener('click', () => {
        setProviderModalOpen(false);
    });
    ProviderUI.saveBtn?.addEventListener('click', async () => {
        await saveProviderSettings();
    });
    ProviderUI.refreshBtn?.addEventListener('click', async () => {
        try {
            await refreshProviderState();
        } catch (error) {
            await appAlert(`AI 설정 상태를 불러오지 못했습니다: ${error.message}`);
        }
    });
    ProviderUI.providerSelect?.addEventListener('change', () => {
        renderProviderModelOptions(ProviderUI.providerSelect.value);
    });

    Object.entries(ProviderUI.inputs).forEach(([providerId, inputEl]) => {
        inputEl?.addEventListener('input', () => {
            const hasInput = Boolean(inputEl.value.trim());
            if (hasInput) {
                ProviderUI.pendingClearProviders.delete(providerId);
            }
            updateProviderKeyStatus(providerId);
        });
    });

    document.querySelectorAll('[data-provider-clear]').forEach(button => {
        button.addEventListener('click', () => {
            const providerId = button.dataset.providerClear;
            if (!providerId || !(providerId in ProviderUI.inputs)) return;

            ProviderUI.pendingClearProviders.add(providerId);
            if (ProviderUI.inputs[providerId]) {
                ProviderUI.inputs[providerId].value = '';
            }
            updateProviderKeyStatus(providerId);
        });
    });

    refreshProviderState().catch(error => {
        console.error('제공자 상태 초기화 실패:', error);
    });
}

function setProviderModalOpen(open) {
    if (!ProviderUI.modal) return;
    ProviderUI.modal.classList.toggle('open', Boolean(open));
}

function providerListFromState(state) {
    return Array.isArray(state?.providers) ? state.providers : [];
}

function resolveActiveProviderId(state) {
    const providers = providerListFromState(state);
    if (!providers.length) return null;

    if (state?.active_provider && providers.some(p => p.id === state.active_provider && p.api_key_set)) {
        return state.active_provider;
    }

    const selectedWithKey = providers.find(p => p.is_selected && p.api_key_set);
    if (selectedWithKey) return selectedWithKey.id;

    const firstAvailable = providers.find(p => p.api_key_set);
    return firstAvailable ? firstAvailable.id : null;
}

function getProviderById(providerId) {
    const providers = providerListFromState(ProviderUI.state);
    return providers.find(provider => provider.id === providerId) || null;
}

function updateAssistantBadge(state) {
    if (!ProviderUI.badge) return;

    const activeProviderId = resolveActiveProviderId(state);
    if (!activeProviderId) {
        ProviderUI.badge.textContent = 'AI 미설정';
        return;
    }

    const provider = providerListFromState(state).find(item => item.id === activeProviderId);
    const providerLabel = PROVIDER_LABELS[activeProviderId] || provider?.label || activeProviderId;
    const model = provider?.selected_model || state?.active_model || '-';
    ProviderUI.badge.textContent = `${providerLabel} · ${model}`;
}

function updateProviderStateText(state) {
    if (!ProviderUI.stateText) return;

    const providers = providerListFromState(state);
    const availableProviders = providers.filter(provider => provider.api_key_set);

    if (!availableProviders.length) {
        ProviderUI.stateText.textContent = '감지된 API 키가 없습니다. 키를 입력하고 저장하면 모델 선택이 활성화됩니다.';
        return;
    }

    const activeProviderId = resolveActiveProviderId(state);
    const activeProvider = availableProviders.find(provider => provider.id === activeProviderId) || null;
    const activeLabel = activeProvider
        ? (PROVIDER_LABELS[activeProvider.id] || activeProvider.label || activeProvider.id)
        : '-';

    ProviderUI.stateText.textContent = `감지된 API ${availableProviders.length}개 | 현재 활성: ${activeLabel}`;
}

function updateProviderKeyStatus(providerId) {
    const statusEl = ProviderUI.keyStatusEls[providerId];
    if (!statusEl) return;

    const provider = getProviderById(providerId);
    const inputEl = ProviderUI.inputs[providerId];
    const hasInput = Boolean(inputEl?.value?.trim());
    const pendingClear = ProviderUI.pendingClearProviders.has(providerId);
    const hasStoredKey = Boolean(provider?.api_key_set);

    statusEl.classList.remove('is-set', 'is-pending-clear');

    if (pendingClear) {
        statusEl.textContent = '삭제 예정';
        statusEl.classList.add('is-pending-clear');
        return;
    }

    if (hasInput) {
        statusEl.textContent = '새 키 입력됨';
        statusEl.classList.add('is-set');
        return;
    }

    if (hasStoredKey) {
        statusEl.textContent = '설정됨';
        statusEl.classList.add('is-set');
        return;
    }

    statusEl.textContent = '미설정';
}

function renderProviderSelectOptions(state) {
    if (!ProviderUI.providerSelect) return;

    const providers = providerListFromState(state);
    const availableProviders = providers.filter(provider => provider.api_key_set);
    const activeProviderId = resolveActiveProviderId(state);

    if (!availableProviders.length) {
        ProviderUI.providerSelect.innerHTML = '<option value="">선택 가능한 제공자 없음</option>';
        ProviderUI.providerSelect.disabled = true;
        return;
    }

    ProviderUI.providerSelect.disabled = false;
    ProviderUI.providerSelect.innerHTML = availableProviders
        .map(provider => {
            const label = PROVIDER_LABELS[provider.id] || provider.label || provider.id;
            return `<option value="${provider.id}">${escapeHtml(label)}</option>`;
        })
        .join('');

    const preferred = providers.some(provider => provider.id === state?.selected_provider && provider.api_key_set)
        ? state.selected_provider
        : activeProviderId;

    ProviderUI.providerSelect.value = preferred || availableProviders[0].id;
}

function renderProviderModelOptions(providerId) {
    if (!ProviderUI.modelSelect) return;

    const provider = getProviderById(providerId);
    const modelOptions = Array.isArray(provider?.model_options) ? provider.model_options : [];
    const selectedModel = provider?.selected_model || modelOptions[0] || '';

    if (!provider || !modelOptions.length) {
        ProviderUI.modelSelect.innerHTML = '<option value="">선택 가능한 모델 없음</option>';
        ProviderUI.modelSelect.disabled = true;
        return;
    }

    ProviderUI.modelSelect.disabled = false;
    ProviderUI.modelSelect.innerHTML = modelOptions
        .map(model => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`)
        .join('');

    if (modelOptions.includes(selectedModel)) {
        ProviderUI.modelSelect.value = selectedModel;
    } else {
        ProviderUI.modelSelect.value = modelOptions[0];
    }
}

function renderProviderState(state) {
    ProviderUI.state = state || null;
    ProviderUI.pendingClearProviders.clear();

    Object.keys(ProviderUI.inputs).forEach(providerId => {
        if (ProviderUI.inputs[providerId]) {
            ProviderUI.inputs[providerId].value = '';
        }
        updateProviderKeyStatus(providerId);
    });

    renderProviderSelectOptions(state);
    renderProviderModelOptions(ProviderUI.providerSelect?.value || null);
    updateProviderStateText(state);
    updateAssistantBadge(state);
}

async function refreshProviderState() {
    try {
        const response = await fetch('/api/providers');
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }
        renderProviderState(data);
    } catch (error) {
        if (ProviderUI.stateText) {
            ProviderUI.stateText.textContent = 'AI 설정 상태를 불러오지 못했습니다.';
        }
        updateAssistantBadge(null);
        throw error;
    }
}

async function saveProviderSettings() {
    const apiKeys = {};
    Object.entries(ProviderUI.inputs).forEach(([providerId, inputEl]) => {
        const value = String(inputEl?.value || '').trim();
        if (value) {
            apiKeys[providerId] = value;
        }
    });

    const payload = {
        api_keys: apiKeys,
        selected_provider: ProviderUI.providerSelect?.disabled ? null : ProviderUI.providerSelect?.value || null,
        selected_model: ProviderUI.modelSelect?.disabled ? null : ProviderUI.modelSelect?.value || null,
        clear_api_keys: Array.from(ProviderUI.pendingClearProviders)
    };

    try {
        const response = await fetch('/api/providers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        ProviderUI.pendingClearProviders.clear();
        renderProviderState(data);
        await appAlert('AI 설정을 저장했습니다.');
    } catch (error) {
        console.error('AI 설정 저장 실패:', error);
        await appAlert(`AI 설정 저장 실패: ${error.message}`);
    }
}

function initHistoryUI() {
    HistoryUI.modal = document.getElementById('historyModal');
    HistoryUI.overlay = document.getElementById('historyOverlay');
    HistoryUI.list = document.getElementById('historyList');
    HistoryUI.nameInput = document.getElementById('historyNameInput');
    HistoryUI.compareBtn = document.getElementById('compareHistoryBtn');
    HistoryUI.clearCompareBtn = document.getElementById('clearCompareSelectionBtn');
    HistoryUI.compareStatus = document.getElementById('compareSelectionStatus');
    HistoryUI.compareResult = document.getElementById('historyCompareResult');

    const historyBtn = document.getElementById('historyBtn');
    const closeHistoryBtn = document.getElementById('closeHistoryBtn');
    const saveHistoryBtn = document.getElementById('saveHistoryBtn');

    historyBtn?.addEventListener('click', async () => {
        openHistoryModal();
        await refreshHistoryList();
    });

    closeHistoryBtn?.addEventListener('click', () => {
        closeHistoryModal();
    });

    HistoryUI.overlay?.addEventListener('click', () => {
        closeHistoryModal();
    });

    saveHistoryBtn?.addEventListener('click', async () => {
        await saveHistoryManually();
    });

    HistoryUI.compareBtn?.addEventListener('click', async () => {
        await compareSelectedHistories();
    });

    HistoryUI.clearCompareBtn?.addEventListener('click', () => {
        HistoryUI.compareSelection = [];
        if (HistoryUI.compareResult) {
            HistoryUI.compareResult.innerHTML = '';
        }
        renderHistoryList(HistoryUI.items);
        updateCompareControls();
    });

    HistoryUI.list?.addEventListener('click', async (event) => {
        const button = event.target.closest('button[data-action]');
        if (!button) return;

        const action = button.dataset.action;
        const historyId = button.dataset.id;
        if (!historyId) return;

        if (action === 'load') {
            await loadHistoryItem(historyId);
        }

        if (action === 'delete') {
            await deleteHistoryItem(historyId);
        }

        if (action === 'toggle-compare') {
            toggleCompareSelection(historyId);
        }
    });

    updateCompareControls();
}

function openHistoryModal() {
    if (!HistoryUI.modal) return;
    HistoryUI.modal.classList.add('open');
}

function closeHistoryModal() {
    if (!HistoryUI.modal) return;
    HistoryUI.modal.classList.remove('open');
}

async function refreshHistoryList() {
    if (!HistoryUI.list) return;

    try {
        const response = await fetch('/api/history');
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error);
        }

        HistoryUI.items = data.items || [];
        const validIds = new Set(HistoryUI.items.map(item => item.id));
        HistoryUI.compareSelection = HistoryUI.compareSelection.filter(id => validIds.has(id));
        if (HistoryUI.compareSelection.length !== 2 && HistoryUI.compareResult) {
            HistoryUI.compareResult.innerHTML = '';
        }
        renderHistoryList(HistoryUI.items);
        updateCompareControls();
    } catch (error) {
        console.error('히스토리 불러오기 실패:', error);
        HistoryUI.list.innerHTML = '<p class="history-empty">히스토리를 불러오지 못했습니다.</p>';
    }
}

function renderHistoryList(items) {
    if (!HistoryUI.list) return;

    if (!items || items.length === 0) {
        HistoryUI.list.innerHTML = '<p class="history-empty">저장된 히스토리가 없습니다.</p>';
        updateCompareControls();
        return;
    }

    HistoryUI.list.innerHTML = items.map(item => {
        const name = escapeHtml(item.name || '이름 없는 설계');
        const airfoil = escapeHtml(item.airfoil_code ? `NACA ${item.airfoil_code}` : 'N/A');
        const span = typeof item.span === 'number' ? `${item.span.toFixed(2)}m` : '-';
        const messageCount = Number.isFinite(item.message_count) ? item.message_count : 0;
        const createdAt = formatHistoryDate(item.created_at);
        const selected = HistoryUI.compareSelection.includes(item.id);
        const itemClass = selected ? 'history-item selected-compare' : 'history-item';
        const compareBtnClass = selected ? 'btn btn-sm btn-primary' : 'btn btn-sm btn-ghost';
        const compareBtnLabel = selected ? '비교 해제' : '비교 선택';

        return `
            <div class="${itemClass}">
                <div class="history-item-header">
                    <h4>${name}</h4>
                    <span class="history-date">${createdAt}</span>
                </div>
                <div class="history-meta">
                    <span>${airfoil}</span>
                    <span>Span ${span}</span>
                    <span>대화 ${messageCount}개</span>
                </div>
                <div class="history-item-actions">
                    <button class="btn btn-sm" data-action="load" data-id="${item.id}">불러오기</button>
                    <button class="${compareBtnClass}" data-action="toggle-compare" data-id="${item.id}">${compareBtnLabel}</button>
                    <button class="btn btn-sm btn-ghost" data-action="delete" data-id="${item.id}">삭제</button>
                </div>
            </div>
        `;
    }).join('');
}

function updateCompareControls() {
    const selectedCount = HistoryUI.compareSelection.length;

    if (HistoryUI.compareBtn) {
        HistoryUI.compareBtn.disabled = selectedCount !== 2;
    }

    if (HistoryUI.clearCompareBtn) {
        HistoryUI.clearCompareBtn.disabled = selectedCount === 0;
    }

    if (HistoryUI.compareStatus) {
        const selectedNames = HistoryUI.compareSelection
            .map(id => HistoryUI.items.find(item => item.id === id)?.name || id)
            .map(name => escapeHtml(name))
            .join(' vs ');
        HistoryUI.compareStatus.innerHTML = selectedNames
            ? `${selectedCount}/2 선택: ${selectedNames}`
            : `${selectedCount}/2 선택`;
    }
}

function toggleCompareSelection(historyId) {
    const current = HistoryUI.compareSelection.slice();
    const existingIndex = current.indexOf(historyId);

    if (existingIndex >= 0) {
        current.splice(existingIndex, 1);
    } else {
        if (current.length >= 2) {
            current.shift();
        }
        current.push(historyId);
    }

    HistoryUI.compareSelection = current;
    if (HistoryUI.compareSelection.length !== 2 && HistoryUI.compareResult) {
        HistoryUI.compareResult.innerHTML = '';
    }
    renderHistoryList(HistoryUI.items);
    updateCompareControls();
}

function formatCompareValue(value, digits = 3, suffix = '') {
    if (!Number.isFinite(Number(value))) {
        return '-';
    }
    return `${Number(value).toFixed(digits)}${suffix}`;
}

function formatSignedCompareValue(value, digits = 3, suffix = '') {
    if (!Number.isFinite(Number(value))) {
        return '-';
    }
    const num = Number(value);
    const sign = num >= 0 ? '+' : '';
    return `${sign}${num.toFixed(digits)}${suffix}`;
}

function deltaClass(value) {
    if (!Number.isFinite(Number(value))) return 'delta-neutral';
    if (Number(value) > 0) return 'delta-up';
    if (Number(value) < 0) return 'delta-down';
    return 'delta-neutral';
}

async function compareSelectedHistories() {
    if (HistoryUI.compareSelection.length !== 2) {
        await appAlert('비교할 히스토리 2개를 선택해 주세요.');
        return;
    }

    const [leftId, rightId] = HistoryUI.compareSelection;

    try {
        const response = await fetch('/api/history/compare', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                left_id: leftId,
                right_id: rightId
            })
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        renderHistoryComparison(data);
    } catch (error) {
        console.error('히스토리 비교 실패:', error);
        await appAlert(`히스토리 비교 실패: ${error.message}`);
    }
}

function renderHistoryComparison(compareData) {
    if (!HistoryUI.compareResult) return;

    const left = compareData.left || {};
    const right = compareData.right || {};
    const leftMetrics = left.metrics || {};
    const rightMetrics = right.metrics || {};
    const delta = compareData.delta || {};

    const metricDefs = [
        { key: 'span', label: 'Span', digits: 3, suffix: ' m' },
        { key: 'root_chord', label: 'Root Chord', digits: 3, suffix: ' m' },
        { key: 'tip_chord', label: 'Tip Chord', digits: 3, suffix: ' m' },
        { key: 'sweep_angle', label: 'Sweep', digits: 2, suffix: '°' },
        { key: 'dihedral_angle', label: 'Dihedral', digits: 2, suffix: '°' },
        { key: 'aspect_ratio', label: 'Aspect Ratio', digits: 3, suffix: '' },
        { key: 'wing_area', label: 'Wing Area', digits: 4, suffix: ' m²' },
        { key: 'mean_chord', label: 'Mean Chord', digits: 4, suffix: ' m' },
        { key: 'CL_max', label: 'CL_max', digits: 3, suffix: '' },
        { key: 'CD_min', label: 'CD_min', digits: 5, suffix: '' },
        { key: 'max_LD', label: 'L/D_max', digits: 2, suffix: '' },
        { key: 'stall_alpha', label: 'Stall α', digits: 2, suffix: '°' }
    ];

    const rows = metricDefs.map(def => {
        const leftValue = leftMetrics[def.key];
        const rightValue = rightMetrics[def.key];
        const diff = delta[def.key]?.absolute;
        const pct = delta[def.key]?.percent;

        const deltaPct = Number.isFinite(Number(pct)) ? ` (${formatSignedCompareValue(pct, 1, '%')})` : '';
        const diffText = Number.isFinite(Number(diff))
            ? `${formatSignedCompareValue(diff, def.digits, def.suffix)}${deltaPct}`
            : '-';

        return `
            <tr>
                <td>${escapeHtml(def.label)}</td>
                <td>${formatCompareValue(leftValue, def.digits, def.suffix)}</td>
                <td>${formatCompareValue(rightValue, def.digits, def.suffix)}</td>
                <td class="${deltaClass(diff)}">${diffText}</td>
            </tr>
        `;
    }).join('');

    const leftName = escapeHtml(left.name || left.id || 'A');
    const rightName = escapeHtml(right.name || right.id || 'B');
    const leftAirfoil = escapeHtml(left.airfoil_code ? `NACA ${left.airfoil_code}` : 'N/A');
    const rightAirfoil = escapeHtml(right.airfoil_code ? `NACA ${right.airfoil_code}` : 'N/A');

    HistoryUI.compareResult.innerHTML = `
        <div class="history-compare-card">
            <div class="history-compare-title">
                <h4>히스토리 비교 결과</h4>
                <span class="history-compare-sub">Δ = 오른쪽 - 왼쪽</span>
            </div>
            <div class="history-compare-sub" style="margin-bottom: 0.4rem;">
                A: ${leftName} (${leftAirfoil})<br>
                B: ${rightName} (${rightAirfoil})
            </div>
            <table class="history-compare-table">
                <thead>
                    <tr>
                        <th>항목</th>
                        <th>A</th>
                        <th>B</th>
                        <th>Δ(B-A)</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

async function saveHistoryManually() {
    if (!AppState.currentSnapshot?.design_data) {
        await appAlert('저장할 설계가 없습니다. 먼저 설계를 완료해 주세요.');
        return;
    }

    const name = HistoryUI.nameInput?.value?.trim() || null;

    try {
        const response = await fetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                snapshot: AppState.currentSnapshot
            })
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        if (HistoryUI.nameInput) {
            HistoryUI.nameInput.value = '';
        }

        await refreshHistoryList();
    } catch (error) {
        console.error('히스토리 저장 실패:', error);
        await appAlert(`히스토리 저장 실패: ${error.message}`);
    }
}

async function loadHistoryItem(historyId) {
    try {
        const response = await fetch(`/api/history/${historyId}/load`, {
            method: 'POST'
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        Chat.setMessages(data.messages || []);

        const designSnapshot = data.design_snapshot;
        const designData = designSnapshot?.design_data;

        if (designData) {
            await handleDesignComplete(designData, {
                snapshot: designSnapshot,
                skipPersist: true,
                autoHistory: false
            });
        } else {
            clearDesignOutputs();
        }

        closeHistoryModal();
    } catch (error) {
        console.error('히스토리 불러오기 실패:', error);
        await appAlert(`히스토리 불러오기 실패: ${error.message}`);
    }
}

async function deleteHistoryItem(historyId) {
    if (!await appConfirm('이 히스토리를 삭제하시겠습니까?')) {
        return;
    }

    try {
        const response = await fetch(`/api/history/${historyId}`, {
            method: 'DELETE'
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error);
        }

        await refreshHistoryList();
    } catch (error) {
        console.error('히스토리 삭제 실패:', error);
        await appAlert(`히스토리 삭제 실패: ${error.message}`);
    }
}

function formatHistoryDate(isoDate) {
    if (!isoDate) return '-';

    const date = new Date(isoDate);
    if (Number.isNaN(date.getTime())) {
        return '-';
    }

    return date.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function escapeHtml(text) {
    return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
