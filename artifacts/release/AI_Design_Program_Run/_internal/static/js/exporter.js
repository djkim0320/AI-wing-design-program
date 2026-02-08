/**
 * 3D 모델 내보내기 모듈 (STL, OBJ)
 */

const Exporter = {

    exportSTL(mesh, filename = 'wing_design.stl') {
        if (!mesh) {
            console.error('내보낼 메쉬가 없습니다');
            return;
        }

        const exporter = new THREE.STLExporter();
        const result = exporter.parse(mesh, { binary: true });

        this.download(result, filename, 'application/octet-stream');
    },

    exportOBJ(mesh, filename = 'wing_design.obj') {
        if (!mesh) {
            console.error('내보낼 메쉬가 없습니다');
            return;
        }

        const exporter = new THREE.OBJExporter();
        const result = exporter.parse(mesh);

        this.download(result, filename, 'text/plain');
    },

    download(data, filename, mimeType) {
        const blob = new Blob([data], { type: mimeType });

        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);
    }
};
