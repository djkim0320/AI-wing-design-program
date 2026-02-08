/**
 * Three.js 3D 날개 뷰어 모듈
 */

const Viewer3D = {
    scene: null,
    camera: null,
    renderer: null,
    controls: null,
    wingMesh: null,
    container: null,
    isInitialized: false,

    disposeMaterial(material) {
        if (!material) return;
        if (Array.isArray(material)) {
            material.forEach(m => m?.dispose && m.dispose());
            return;
        }
        if (material.dispose) {
            material.dispose();
        }
    },

    disposeObject3D(object3d) {
        if (!object3d) return;
        object3d.traverse(node => {
            if (node.geometry && node.geometry.dispose) {
                node.geometry.dispose();
            }
            if (node.material) {
                this.disposeMaterial(node.material);
            }
        });
    },

    init() {
        this.container = document.getElementById('viewer3d');
        if (!this.container || this.isInitialized) return;

        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x0f172a);

        // Camera
        const width = this.container.clientWidth;
        const height = this.container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
        this.camera.position.set(3, 2, 3);

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ antialias: true });
        this.renderer.setSize(width, height);
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // 기존 캔버스 제거 후 추가
        const existingCanvas = this.container.querySelector('canvas');
        if (existingCanvas) existingCanvas.remove();

        // 플레이스홀더 숨기기
        const placeholder = this.container.querySelector('.placeholder-content');
        if (placeholder) placeholder.style.display = 'none';

        this.container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.minDistance = 0.5;
        this.controls.maxDistance = 10;

        // Lights
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(5, 10, 5);
        this.scene.add(directionalLight);

        const backLight = new THREE.DirectionalLight(0x60a5fa, 0.3);
        backLight.position.set(-5, -5, -5);
        this.scene.add(backLight);

        // Grid Helper
        const gridHelper = new THREE.GridHelper(4, 20, 0x334155, 0x1e293b);
        this.scene.add(gridHelper);

        // Axes Helper
        const axesHelper = new THREE.AxesHelper(0.5);
        this.scene.add(axesHelper);

        // 리사이즈 핸들러
        window.addEventListener('resize', () => this.onResize());

        // 애니메이션 시작
        this.animate();

        this.isInitialized = true;
    },

    onResize() {
        if (!this.container || !this.camera || !this.renderer) return;

        const width = this.container.clientWidth;
        const height = this.container.clientHeight;

        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    },

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.controls) {
            this.controls.update();
        }

        if (this.renderer && this.scene && this.camera) {
            this.renderer.render(this.scene, this.camera);
        }
    },

    createWingMesh(meshData) {
        if (!this.scene) {
            this.init();
        }

        // 기존 날개 제거
        if (this.wingMesh) {
            this.scene.remove(this.wingMesh);
            this.disposeObject3D(this.wingMesh);
            this.wingMesh = null;
        }

        // 정점 데이터 생성
        const vertices = new Float32Array(meshData.vertices.flat());
        const indices = new Uint32Array(meshData.faces.flat());

        // BufferGeometry 생성
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        geometry.computeVertexNormals();

        // 재질 생성
        const material = new THREE.MeshPhongMaterial({
            color: 0x3b82f6,
            specular: 0x60a5fa,
            shininess: 30,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.9
        });

        // 와이어프레임 추가
        const wireframeMaterial = new THREE.MeshBasicMaterial({
            color: 0x60a5fa,
            wireframe: true,
            transparent: true,
            opacity: 0.2
        });

        // 그룹으로 묶기
        this.wingMesh = new THREE.Group();

        const solidMesh = new THREE.Mesh(geometry, material);
        const wireframeMesh = new THREE.Mesh(geometry.clone(), wireframeMaterial);

        this.wingMesh.add(solidMesh);
        this.wingMesh.add(wireframeMesh);

        // 중심 맞추기
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        this.wingMesh.position.set(-center.x, 0, -center.z);

        this.scene.add(this.wingMesh);

        // 컨트롤 표시
        const controlsEl = document.getElementById('viewerControls');
        if (controlsEl) controlsEl.style.display = 'flex';

        // 카메라 위치 조정
        this.resetView();
    },

    resetView() {
        if (!this.camera || !this.controls) return;

        this.camera.position.set(3, 2, 3);
        this.controls.target.set(0, 0, 0);
        this.controls.update();
    },

    getMesh() {
        if (!this.wingMesh) return null;
        return this.wingMesh.children[0]; // 솔리드 메쉬 반환
    },

    clear() {
        if (this.wingMesh && this.scene) {
            this.scene.remove(this.wingMesh);
            this.disposeObject3D(this.wingMesh);
            this.wingMesh = null;
        }

        const controlsEl = document.getElementById('viewerControls');
        if (controlsEl) controlsEl.style.display = 'none';

        const placeholder = this.container?.querySelector('.placeholder-content');
        if (placeholder) placeholder.style.display = 'flex';
    }
};
