/**
 * 에어포일 2D 시각화 모듈
 */

const AirfoilViewer = {
    canvas: null,
    ctx: null,
    currentData: null,
    chordLength: 0.07, // 기본 코드 길이 (m), 설계 시 업데이트됨

    init() {
        this.canvas = document.getElementById('airfoilCanvas');
        if (!this.canvas) return;

        this.ctx = this.canvas.getContext('2d');
        this.resize();
        window.addEventListener('resize', () => this.resize());
    },

    resize() {
        if (!this.canvas) return;

        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;

        if (this.currentData) {
            this.draw(this.currentData);
        }
    },

    setChordLength(chord) {
        this.chordLength = chord;
    },

    draw(data) {
        if (!this.ctx || !data) return;

        this.currentData = data;
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;

        // 배경 클리어
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, 0, width, height);

        // 그리드 그리기
        this.drawGrid(width, height);

        // 변환 설정 (중앙 정렬, 스케일) - 치수선 공간 확보
        const padding = 80;
        const scale = Math.min(
            (width - padding * 2) / 1.1,
            (height - padding * 2) / 0.5
        );
        const offsetX = padding + 0.05 * scale;
        const offsetY = height / 2 + 10;

        // 실제 치수 계산 (m → cm)
        const chordCm = this.chordLength * 100;
        const maxThickness = data.max_thickness / 100; // 비율
        const thicknessCm = this.chordLength * maxThickness * 100;

        // 최대 두께 위치 찾기
        let maxY_upper = 0, maxY_lower = 0, maxThicknessX = 0;
        data.upper.forEach(pt => {
            if (pt.y > maxY_upper) {
                maxY_upper = pt.y;
                maxThicknessX = pt.x;
            }
        });
        data.lower.forEach(pt => {
            if (pt.y < maxY_lower) {
                maxY_lower = pt.y;
            }
        });

        // 캠버 라인 그리기
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(245, 158, 11, 0.5)';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);

        data.camber.forEach((pt, i) => {
            const x = offsetX + pt.x * scale;
            const y = offsetY - pt.y * scale;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // 에어포일 형상 그리기
        ctx.beginPath();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';

        // 상면
        data.upper.forEach((pt, i) => {
            const x = offsetX + pt.x * scale;
            const y = offsetY - pt.y * scale;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });

        // 하면 (역순)
        for (let i = data.lower.length - 1; i >= 0; i--) {
            const pt = data.lower[i];
            const x = offsetX + pt.x * scale;
            const y = offsetY - pt.y * scale;
            ctx.lineTo(x, y);
        }

        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // ============ 치수선 그리기 ============

        // 코드 라인 (가로 치수)
        const dimColor = '#10b981';
        const dimLineY = offsetY + 50;

        ctx.beginPath();
        ctx.strokeStyle = dimColor;
        ctx.lineWidth = 1;

        // 가로 치수선
        ctx.moveTo(offsetX, dimLineY);
        ctx.lineTo(offsetX + scale, dimLineY);

        // 끝단 마커 (수직선)
        ctx.moveTo(offsetX, dimLineY - 8);
        ctx.lineTo(offsetX, dimLineY + 8);
        ctx.moveTo(offsetX + scale, dimLineY - 8);
        ctx.lineTo(offsetX + scale, dimLineY + 8);

        // 에어포일까지 연결선
        ctx.setLineDash([2, 2]);
        ctx.moveTo(offsetX, offsetY);
        ctx.lineTo(offsetX, dimLineY);
        ctx.moveTo(offsetX + scale, offsetY);
        ctx.lineTo(offsetX + scale, dimLineY);
        ctx.stroke();
        ctx.setLineDash([]);

        // 가로 치수 텍스트
        ctx.fillStyle = dimColor;
        ctx.font = 'bold 13px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${chordCm.toFixed(1)} cm`, offsetX + scale / 2, dimLineY + 20);

        // 세로 치수선 (최대 두께)
        const thickX = offsetX + maxThicknessX * scale;
        const thickTopY = offsetY - maxY_upper * scale;
        const thickBottomY = offsetY - maxY_lower * scale;
        const dimLineX = offsetX + scale + 40;

        ctx.beginPath();
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1;

        // 세로 치수선
        ctx.moveTo(dimLineX, thickTopY);
        ctx.lineTo(dimLineX, thickBottomY);

        // 끝단 마커 (수평선)
        ctx.moveTo(dimLineX - 8, thickTopY);
        ctx.lineTo(dimLineX + 8, thickTopY);
        ctx.moveTo(dimLineX - 8, thickBottomY);
        ctx.lineTo(dimLineX + 8, thickBottomY);

        // 에어포일까지 연결선
        ctx.setLineDash([2, 2]);
        ctx.moveTo(thickX, thickTopY);
        ctx.lineTo(dimLineX, thickTopY);
        ctx.moveTo(thickX, thickBottomY);
        ctx.lineTo(dimLineX, thickBottomY);
        ctx.stroke();
        ctx.setLineDash([]);

        // 세로 치수 텍스트
        ctx.save();
        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 12px Inter, sans-serif';
        ctx.translate(dimLineX + 20, (thickTopY + thickBottomY) / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.textAlign = 'center';
        ctx.fillText(`${thicknessCm.toFixed(2)} cm`, 0, 0);
        ctx.restore();

        // 레이블
        ctx.fillStyle = '#f1f5f9';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`NACA ${data.code}`, width / 2, 25);

        ctx.font = '11px Inter, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`코드 길이: ${chordCm.toFixed(1)}cm | 최대 두께: ${thicknessCm.toFixed(2)}cm (${data.max_thickness}%)`, width / 2, 45);

        ctx.font = '10px Inter, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.textAlign = 'left';
        ctx.fillText('Leading Edge', offsetX - 10, height - 10);
        ctx.textAlign = 'right';
        ctx.fillText('Trailing Edge', offsetX + scale + 10, height - 10);
    },

    drawGrid(width, height) {
        const ctx = this.ctx;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.lineWidth = 1;

        const gridSize = 50;

        // 수직선
        for (let x = 0; x < width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }

        // 수평선
        for (let y = 0; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
    },

    updateInfo(data) {
        const infoEl = document.getElementById('airfoilInfo');
        if (!infoEl || !data) return;

        const chordCm = this.chordLength * 100;
        const thicknessCm = this.chordLength * (data.max_thickness / 100) * 100;

        infoEl.innerHTML = `
            <div class="specs-grid">
                <div class="spec-card">
                    <h4>에어포일 코드</h4>
                    <div class="value">NACA ${data.code}</div>
                </div>
                <div class="spec-card">
                    <h4>코드 길이</h4>
                    <div class="value">${chordCm.toFixed(1)}<span class="unit">cm</span></div>
                </div>
                <div class="spec-card">
                    <h4>최대 두께</h4>
                    <div class="value">${thicknessCm.toFixed(2)}<span class="unit">cm</span> (${data.max_thickness}%)</div>
                </div>
                <div class="spec-card">
                    <h4>캠버 위치</h4>
                    <div class="value">${data.max_camber_position.toFixed(0)}<span class="unit">%</span></div>
                </div>
            </div>
        `;
    },

    clear() {
        if (!this.ctx) return;
        this.ctx.fillStyle = '#1e293b';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.currentData = null;
        this.chordLength = 0.07;

        const infoEl = document.getElementById('airfoilInfo');
        if (infoEl) {
            infoEl.innerHTML = '<p>설계된 에어포일 정보가 여기에 표시됩니다.</p>';
        }
    }
};
