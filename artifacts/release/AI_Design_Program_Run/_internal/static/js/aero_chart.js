/**
 * 에어포일 공기역학 성능 그래프 모듈
 * Chart.js 기반 CL/CD/L/D 시각화 + 확장 참고지표 표시
 */

const AeroChart = {
    chartCL: null,
    chartLD: null,
    currentData: null,

    init() {
        if (typeof Chart === 'undefined') {
            console.warn('Chart.js가 로드되지 않았습니다.');
            return;
        }

        Chart.defaults.color = '#94a3b8';
        Chart.defaults.borderColor = 'rgba(255,255,255,0.1)';
    },

    async analyze(airfoilCode, reynolds = 200000) {
        try {
            const response = await fetch('/api/analyze-aero', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: airfoilCode,
                    reynolds: reynolds,
                    alpha_start: -5,
                    alpha_end: 20
                })
            });

            const data = await response.json();

            if (data.error) {
                console.error('분석 오류:', data.error);
                this.showError(data.error);
                return null;
            }

            this.currentData = data;
            this.render(data);
            return data;

        } catch (error) {
            console.error('API 호출 오류:', error);
            this.showError('서버 연결 오류');
            return null;
        }
    },

    fmt(value, digits = 2, suffix = '') {
        if (value === null || value === undefined || Number.isNaN(Number(value))) {
            return '-';
        }
        return `${Number(value).toFixed(digits)}${suffix}`;
    },

    escapeHtml(text) {
        return String(text)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    render(data) {
        if (!data || !data.alpha) return;

        const container = document.getElementById('specsContainer');
        if (!container) return;

        const analysis = data.analysis || {};
        const ref = data.reference || {};

        const metricCards = [
            { label: '최대 CL', value: this.fmt(analysis.CL_max, 2), sub: `@ α = ${this.fmt(analysis.stall_alpha, 1, '°')}` },
            { label: '최대 L/D', value: this.fmt(analysis.max_LD, 1), sub: `@ α = ${this.fmt(analysis.alpha_max_LD, 1, '°')}` },
            { label: '최소 CD', value: this.fmt((analysis.CD_min || 0) * 10000, 1), sub: 'counts' },
            { label: '제로양력 α', value: this.fmt(analysis.alpha_zero_lift, 1, '°'), sub: 'CL = 0 지점' },
            { label: 'CLα', value: this.fmt(ref.CL_alpha_per_rad, 2), sub: '1/rad' },
            { label: 'CMα', value: this.fmt(ref.CM_alpha_per_rad, 2), sub: '1/rad' },
            { label: 'CM 범위', value: this.fmt(ref.CM_range, 3), sub: `${this.fmt(ref.CM_min, 3)} ~ ${this.fmt(ref.CM_max, 3)}` },
            { label: 'Endurance Index', value: this.fmt(ref.endurance_index_max, 1), sub: `@ α = ${this.fmt(ref.alpha_endurance_max, 1, '°')}` }
        ];

        const referenceRows = [
            { k: 'CD@CL=0', v: this.fmt(ref.CD_at_zero_lift, 5) },
            { k: 'CL@α=0°', v: this.fmt(ref.CL_at_alpha_0, 3) },
            { k: 'CM@α=0°', v: this.fmt(ref.CM_at_alpha_0, 3) },
            { k: 'α(min CD)', v: this.fmt(ref.alpha_min_CD, 2, '°') },
            { k: 'CL@max L/D', v: this.fmt(ref.CL_at_max_LD, 3) },
            { k: 'CD@max L/D', v: this.fmt(ref.CD_at_max_LD, 5) },
            { k: 'LD@CL=0', v: this.fmt(ref.LD_at_zero_lift, 2) },
            { k: '안정성 프록시', v: this.fmt(ref.stability_margin_proxy, 2) },
            { k: 'Top_Xtr 평균', v: this.fmt(ref.Top_Xtr_mean, 3) },
            { k: 'Bot_Xtr 평균', v: this.fmt(ref.Bot_Xtr_mean, 3) },
            { k: 'Top_Xtr@maxL/D', v: this.fmt(ref.Top_Xtr_at_max_LD, 3) },
            { k: 'Bot_Xtr@maxL/D', v: this.fmt(ref.Bot_Xtr_at_max_LD, 3) }
        ].filter(row => row.v !== '-');

        const safeAirfoilCode = this.escapeHtml(data.airfoil_code ?? '-');
        const reynoldsLabel = Number.isFinite(Number(data.reynolds))
            ? Number(data.reynolds).toLocaleString()
            : '-';

        container.innerHTML = `
            <div class="aero-analysis">
                <div class="analysis-header">
                    <h3>NACA ${safeAirfoilCode} 성능 분석</h3>
                    <div class="reynolds-info">Re = ${reynoldsLabel}</div>
                </div>

                <div class="key-metrics">
                    ${metricCards.map(card => `
                        <div class="metric">
                            <span class="label">${card.label}</span>
                            <span class="value">${card.value}</span>
                            <span class="sub">${card.sub}</span>
                        </div>
                    `).join('')}
                </div>

                <div class="aero-reference-card">
                    <h4>NeuralFoil 참고 데이터</h4>
                    <div class="aero-reference-grid">
                        ${referenceRows.map(row => `
                            <div class="ref-row">
                                <span class="ref-key">${row.k}</span>
                                <span class="ref-val">${row.v}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="charts-container">
                    <div class="chart-wrapper">
                        <canvas id="chartCLCD"></canvas>
                    </div>
                    <div class="chart-wrapper">
                        <canvas id="chartLD"></canvas>
                    </div>
                </div>
            </div>
        `;

        this.createCLCDChart(data);
        this.createLDChart(data);
    },

    createCLCDChart(data) {
        const ctx = document.getElementById('chartCLCD');
        if (!ctx) return;

        if (this.chartCL) {
            this.chartCL.destroy();
        }

        this.chartCL = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.alpha,
                datasets: [
                    {
                        label: 'CL (양력계수)',
                        data: data.CL,
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        fill: true,
                        tension: 0.3,
                        yAxisID: 'yCL'
                    },
                    {
                        label: 'CD × 100',
                        data: data.CD.map(v => v * 100),
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fill: true,
                        tension: 0.3,
                        yAxisID: 'yCD'
                    },
                    {
                        label: 'CM × 10',
                        data: (data.CM || []).map(v => v * 10),
                        borderColor: '#a78bfa',
                        backgroundColor: 'rgba(167, 139, 250, 0.08)',
                        fill: false,
                        tension: 0.25,
                        yAxisID: 'yCM'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    title: {
                        display: true,
                        text: 'CL / CD / CM vs 받음각',
                        color: '#f1f5f9'
                    },
                    legend: {
                        labels: { color: '#94a3b8' }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: '받음각 α (°)', color: '#94a3b8' },
                        ticks: { color: '#64748b' },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    yCL: {
                        type: 'linear',
                        position: 'left',
                        title: { display: true, text: 'CL', color: '#3b82f6' },
                        ticks: { color: '#3b82f6' },
                        grid: { color: 'rgba(59, 130, 246, 0.1)' }
                    },
                    yCD: {
                        type: 'linear',
                        position: 'right',
                        title: { display: true, text: 'CD × 100', color: '#ef4444' },
                        ticks: { color: '#ef4444' },
                        grid: { drawOnChartArea: false }
                    },
                    yCM: {
                        type: 'linear',
                        position: 'right',
                        display: false
                    }
                }
            }
        });
    },

    createLDChart(data) {
        const ctx = document.getElementById('chartLD');
        if (!ctx) return;

        if (this.chartLD) {
            this.chartLD.destroy();
        }

        const maxLDIndex = data.LD_ratio.indexOf(Math.max(...data.LD_ratio));

        this.chartLD = new Chart(ctx, {
            type: 'line',
            data: {
                labels: data.alpha,
                datasets: [{
                    label: 'L/D 비율',
                    data: data.LD_ratio,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: data.alpha.map((_, i) => i === maxLDIndex ? 8 : 2),
                    pointBackgroundColor: data.alpha.map((_, i) =>
                        i === maxLDIndex ? '#fbbf24' : '#10b981'
                    )
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: '양항비 (L/D) vs 받음각',
                        color: '#f1f5f9'
                    },
                    legend: {
                        labels: { color: '#94a3b8' }
                    }
                },
                scales: {
                    x: {
                        title: { display: true, text: '받음각 α (°)', color: '#94a3b8' },
                        ticks: { color: '#64748b' },
                        grid: { color: 'rgba(255,255,255,0.05)' }
                    },
                    y: {
                        title: { display: true, text: 'L/D', color: '#10b981' },
                        ticks: { color: '#10b981' },
                        grid: { color: 'rgba(16, 185, 129, 0.1)' }
                    }
                }
            }
        });
    },

    showError(message) {
        const container = document.getElementById('specsContainer');
        if (!container) return;
        const safeMessage = this.escapeHtml(message || '알 수 없는 오류');

        container.innerHTML = `
            <div class="aero-error">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <p>${safeMessage}</p>
                <small>NeuralFoil 설치: pip install neuralfoil</small>
            </div>
        `;
    },

    clear() {
        if (this.chartCL) {
            this.chartCL.destroy();
            this.chartCL = null;
        }
        if (this.chartLD) {
            this.chartLD.destroy();
            this.chartLD = null;
        }
        this.currentData = null;

        const container = document.getElementById('specsContainer');
        if (container) {
            container.innerHTML = `
                <div class="spec-placeholder">
                    <p>날개 설계가 완료되면 성능 분석 결과가 표시됩니다.</p>
                </div>
            `;
        }
    }
};
