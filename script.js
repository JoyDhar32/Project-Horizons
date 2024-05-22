import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { createNoise2D } from 'simplex-noise';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;

const noise2D = createNoise2D();

let camera, scene, renderer, controls;

const objects = [];
let raycaster;

let moveForward = false;
let moveBackward = false;
let moveLeft = false;
let moveRight = false;
let canJump = false;

let prevTime = performance.now();
const velocity = new THREE.Vector3();
const direction = new THREE.Vector3();

const FLOOR_SIZE = 2000;
let generateFloor;
const floors = {};

const textures = [
    'texture/Stylized_Stone_Floor_005_basecolor.jpg',
    'texture/Lava_001_COLOR.png',
    'texture/Gravel_001_BaseColor.jpg'
];

const loader = new GLTFLoader();
let loadedModels = {};

// replaceGeometryWithModel 
function replaceGeometryWithModel(url, geometryName) {
    return new Promise((resolve, reject) => {
        loader.load(url, function (gltf) {
            const model = gltf.scene;
            model.traverse((child) => {
                if (child.isMesh) {
                    child.geometry.computeBoundsTree(); 
                }
            });
            loadedModels[geometryName] = model;
            resolve(model);
        }, undefined, function (error) {
            reject(error);
        });
    });
}

// use Promise.all to load all models
Promise.all([
    replaceGeometryWithModel('model/maple_tree.glb', 'box'),
    replaceGeometryWithModel('model/asia_building.glb', 'sphere'),
    replaceGeometryWithModel('model/dragon_5.glb', 'cylinder')
]).then(() => {
    init();
    animate();
}).catch((error) => {
    console.error('Error loading models:', error);
});

function init() {
    THREE.ColorManagement.enabled = false;

    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
    camera.position.y = 10;

    scene = new THREE.Scene();
    scene.background = new THREE.Color('#87CEEB');
    scene.fog = new THREE.Fog('#87CEEB', 0, 750);

    const light = new THREE.HemisphereLight(0xeeeeff, 'blue', 2.5);
    light.position.set(0.5, 1, 0.75);
    scene.add(light);

    controls = new PointerLockControls(camera, document.body);

    const blocker = document.getElementById('blocker');
    const instructions = document.getElementById('instructions');

    instructions.addEventListener('click', function () {
        controls.lock();
    });

    controls.addEventListener('lock', function () {
        instructions.style.display = 'none';
        blocker.style.display = 'none';
    });

    controls.addEventListener('unlock', function () {
        blocker.style.display = 'block';
        instructions.style.display = '';
    });

    scene.add(controls.getObject());

    const onKeyDown = function (event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = true;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = true;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = true;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = true;
                break;
            case 'Space':
                if (canJump === true) velocity.y += 350;
                canJump = false;
                break;
        }
    };

    const onKeyUp = function (event) {
        switch (event.code) {
            case 'ArrowUp':
            case 'KeyW':
                moveForward = false;
                break;
            case 'ArrowLeft':
            case 'KeyA':
                moveLeft = false;
                break;
            case 'ArrowDown':
            case 'KeyS':
                moveBackward = false;
                break;
            case 'ArrowRight':
            case 'KeyD':
                moveRight = false;
                break;
        }
    };

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0), 0, 10);

    generateFloor = (x, z) => {
        console.log('generating floor', x, z);

        // geometry
        let floorGeometry = new THREE.BufferGeometry();
        const subdivisions = 100;
        const indices = [];
        const vertices = [];
        const uvs = []; //uvs

        for (let i = 0; i <= subdivisions; i++) {
            for (let j = 0; j <= subdivisions; j++) {
                const x1 = i / subdivisions;
                const z1 = j / subdivisions;
                vertices.push(x1 * FLOOR_SIZE - FLOOR_SIZE / 2, noise2D(x + x1, z + z1) * FLOOR_SIZE / 10, z1 * FLOOR_SIZE - FLOOR_SIZE / 2);
                let u = i / subdivisions; //uvs
                let v = j / subdivisions;
                uvs.push(u, v);
            }
        }

        floorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        floorGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));

        for (let x = 0; x < subdivisions; x++) {
            for (let z = 0; z < subdivisions; z++) {
                const a = z + x * (subdivisions + 1);
                const b = (z + 1) + x * (subdivisions + 1);
                const c = z + (x + 1) * (subdivisions + 1);
                const d = (z + 1) + (x + 1) * (subdivisions + 1);
                indices.push(a, b, d);
                indices.push(d, c, a);
            }
        }
        floorGeometry.setIndex(indices);
        floorGeometry.computeVertexNormals();

        //texture
        const randomTexture = textures[Math.floor(Math.random() * textures.length)];
        let texture = new THREE.TextureLoader().load(randomTexture);
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(20, 20);

        let newMaterial = new THREE.MeshBasicMaterial({ map: texture });
        let floorMesh = new THREE.Mesh(floorGeometry, newMaterial);
        floorMesh.position.set(x * FLOOR_SIZE, 0, z * FLOOR_SIZE);
        floorMesh.geometry.computeBoundsTree();
        scene.add(floorMesh);
        floors[`${x},${z}`] = floorMesh;

        const range = FLOOR_SIZE / 2;
        for (let i = 0; i < FLOOR_SIZE / 100; i++) {
            const createAndPositionModel = (geometryName) => {
                const model = loadedModels[geometryName].clone();
                const setY = (item) => {
                    const raycaster = new THREE.Raycaster(new THREE.Vector3(item.position.x, 1000, item.position.z), new THREE.Vector3(0, -1, 0));
                    raycaster.firstHitOnly = true;
                    const intersects = raycaster.intersectObject(floorMesh);
                    if (intersects.length > 0) item.position.y = intersects[0].point.y + 10;
                };
                model.position.set(Math.random() * range * 2 - range, 0, Math.random() * range * 2 - range);
                setY(model);
                floorMesh.add(model);
                objects.push(model);
            };

            createAndPositionModel('box');
            createAndPositionModel('sphere');
            createAndPositionModel('cylinder');
        }
    }

    generateFloor(0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
    requestAnimationFrame(animate);

    const time = performance.now();

    if (controls.isLocked === true) {
        raycaster.ray.origin.copy(controls.getObject().position);
        raycaster.ray.origin.y -= 10;

        const intersections = raycaster.intersectObjects(objects, false);
        const onObject = intersections.length > 0;

        const delta = (time - prevTime) / 1000;

        velocity.x -= velocity.x * 10.0 * delta;
        velocity.z -= velocity.z * 10.0 * delta;
        velocity.y -= 9.8 * 100.0 * delta; // 100.0 = mass

        direction.z = Number(moveForward) - Number(moveBackward);
        direction.x = Number(moveRight) - Number(moveLeft);
        direction.normalize(); // this ensures consistent movements in all directions

        if (moveForward || moveBackward) velocity.z -= direction.z * 400.0 * delta;
        if (moveLeft || moveRight) velocity.x -= direction.x * 400.0 * delta;

        if (onObject === true) {
            velocity.y = Math.max(0, velocity.y);
            canJump = true;
        }

        controls.moveRight(- velocity.x * delta * 10);
        controls.moveForward(- velocity.z * delta * 10);

        controls.getObject().position.y += (velocity.y * delta); // new behavior

        const controlsPos = controls.getObject().position;
        const [x, z] = [Math.round(controlsPos.x / FLOOR_SIZE), Math.round(controlsPos.z / FLOOR_SIZE)];
        if (!floors[`${x},${z}`]) generateFloor(x, z);
        if (!floors[`${x + 1},${z}`]) generateFloor(x + 1, z);
        if (!floors[`${x - 1},${z}`]) generateFloor(x - 1, z);
        if (!floors[`${x},${z + 1}`]) generateFloor(x, z + 1);
        if (!floors[`${x},${z - 1}`]) generateFloor(x, z - 1);
        if (!floors[`${x + 1},${z + 1}`]) generateFloor(x + 1, z + 1);
        if (!floors[`${x - 1},${z + 1}`]) generateFloor(x - 1, z + 1);
        if (!floors[`${x + 1},${z - 1}`]) generateFloor(x + 1, z - 1);
        if (!floors[`${x - 1},${z - 1}`]) generateFloor(x - 1, z - 1);

        if (controls.getObject().position.y < 10) {
            velocity.y = 0;
            controls.getObject().position.y = 10;
            canJump = true;
        }
    }

    prevTime = time;

    renderer.render(scene, camera);
}
