
import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { createNoise2D } from 'simplex-noise';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';

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
const vertex = new THREE.Vector3();
const color = new THREE.Color();

const FLOOR_SIZE = 2000;
let generateFloor;
const floors = {};

const boxGeometry = new THREE.BoxGeometry(100, 100, 100).toNonIndexed();
const boxMaterial = new THREE.MeshPhongMaterial({ specular: 'purple', flatShading: true, vertexColors: true });
boxMaterial.color.setHSL(Math.random() * 0.2 + 0.5, 0.75, Math.random() * 0.25 + 0.75, THREE.SRGBColorSpace);
const sphereGeometry = new THREE.SphereGeometry(15, 48, 48); // Adjust radius, segments for smoothness
const sphereMaterial = new THREE.MeshBasicMaterial({ color: '#9D941B' }); // Set a single color
const cylinderGeometry = new THREE.CylinderGeometry(8, 8, 8, 64); // Adjust radius top/bottom, height, segments for smoothness
const cylinderMaterial = new THREE.MeshBasicMaterial({ color: 'orange' });

boxGeometry.computeBoundsTree();
// sphereGeometry.computeBoundsTree();
// cylinderGeometry.computeBoundsTree();



const textureLoader = new THREE.TextureLoader();
textureLoader.load('./css/image/boxImage.png',
    function (texture) {
        boxMaterial.map = texture;
        boxMaterial.needsUpdate = true;
    },
)

const loader = new GLTFLoader();

loader.load('./css/gltf/smallHut/scene.gltf', function (gltf) {
    const modelMesh = gltf.scene;
    modelMesh.position.set(0, 0, 0);
    modelMesh.scale.set(2, 2, 2);
    modelMesh.rotation.set(0, Math.PI / 2, 0);
    scene.add(modelMesh);
    generateFloor();
});



init();
animate();

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

    raycaster = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, - 1, 0), 0, 10);

    const floorMaterial = new THREE.MeshBasicMaterial({ vertexColors: true });

    generateFloor = (x, z) => {
        console.log('generating floor', x, z);

        // geometry
        let floorGeometry = new THREE.BufferGeometry();
        const subdivisions = 100;
        const indices = [];
        const vertices = [];
        for (let i = 0; i <= subdivisions; i++) {
            for (let j = 0; j <= subdivisions; j++) {
                const x1 = i / subdivisions;
                const z1 = j / subdivisions;
                vertices.push(x1 * FLOOR_SIZE - FLOOR_SIZE / 2, noise2D(x + x1, z + z1) * FLOOR_SIZE / 10, z1 * FLOOR_SIZE - FLOOR_SIZE / 2);
            }
        }
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
        floorGeometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        floorGeometry.computeVertexNormals();


        // vertex displacement

        let position = floorGeometry.attributes.position;

        for (let i = 0, l = position.count; i < l; i++) {

            vertex.fromBufferAttribute(position, i);

            const isEdge = vertex.x === FLOOR_SIZE / 2 || vertex.x === -FLOOR_SIZE / 2 || vertex.z === FLOOR_SIZE / 2 || vertex.z === -FLOOR_SIZE / 2;
            if (!isEdge) {
                vertex.x += Math.random() * FLOOR_SIZE / 100 - FLOOR_SIZE / 200;
                vertex.y += Math.random() * FLOOR_SIZE / 1000;
                vertex.z += Math.random() * FLOOR_SIZE / 100 - FLOOR_SIZE / 200;
                vertex.x = Math.min(FLOOR_SIZE / 2, Math.max(- FLOOR_SIZE / 2, vertex.x));
                vertex.z = Math.min(FLOOR_SIZE / 2, Math.max(- FLOOR_SIZE / 2, vertex.z));
            }

            position.setXYZ(i, vertex.x, vertex.y, vertex.z);

        }

        floorGeometry = floorGeometry.toNonIndexed(); // ensure each face has unique vertices

        position = floorGeometry.attributes.position;
        const colorsFloor = [];

        for (let i = 0, l = position.count; i < l; i++) {

            color.setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75, THREE.SRGBColorSpace);
            colorsFloor.push(color.r, color.g, color.b);

        }

        floorGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colorsFloor, 3));


        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        scene.add(floor);

        // objects

        position = boxGeometry.attributes.position;
        const colorsBox = [];

        for (let i = 0, l = position.count; i < l; i++) {

            color.setHSL(Math.random() * 0.3 + 0.5, 0.75, Math.random() * 0.25 + 0.75, THREE.SRGBColorSpace);
            colorsBox.push(color.r, color.g, color.b);

        }

        boxGeometry.setAttribute('color', new THREE.Float32BufferAttribute(colorsBox, 3));

        // Creating Boxes

        floorGeometry.computeBoundsTree();
        for (let i = 0; i < FLOOR_SIZE / 100; i++) {
            let range = FLOOR_SIZE / 2;
            const box = new THREE.Mesh(boxGeometry, boxMaterial);
            const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
            const cylinder = new THREE.Mesh(cylinderGeometry, cylinderMaterial);

            const setY = (item) => {
                const raycaster = new THREE.Raycaster(new THREE.Vector3(item.position.x, 0, item.position.z), new THREE.Vector3(0, 0, 0));
                raycaster.firstHitOnly = false; // Set to check all intersections
                const intersects = raycaster.intersectObject(floor);
                if (intersects.length > 0) {
                    // Iterate over all intersections and adjust Y position accordingly
                    for (let i = 0; i < intersects.length; i++) {
                        const intersection = intersects[i];
                        console.log('collision', intersection.point.y);

                    }
                }
            }

            box.position.x = Math.random() * range * 4 - range; // Ensures values between -floorSize and floorSize
            box.position.z = Math.random() * range * 4 - range; // Ensures values between -floorSize and floorSize
            sphere.position.x = Math.random() * range * 2 - range; // Ensures values between -floorSize and floorSize
            sphere.position.z = Math.random() * range * 2 - range; // Ensures values between -floorSize and floorSize
            cylinder.position.x = Math.random() * range * 2 - range; // Ensures values between -floorSize and floorSize
            cylinder.position.z = Math.random() * range * 2 - range; // Ensures values between -floorSize and floorSize



            setY(box);
            setY(sphere);
            setY(cylinder);





            floor.add(box);
            // floor.add(sphere);
            // floor.add(cylinder);
            objects.push(box);
            // objects.push(sphere);
            // objects.push(cylinder);

        }

        floor.position.x = x * FLOOR_SIZE;
        floor.position.z = z * FLOOR_SIZE;
        floors[`${x},${z}`] = floor;
    }

    generateFloor(0, 0);



    //

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    //

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
    let playerHeight = 50;
    let groundHeight = 10;

    if (controls.isLocked === true) {
        raycaster.ray.origin.copy(controls.getObject().position);
        raycaster.ray.origin.y += playerHeight;

        const intersections = raycaster.intersectObjects(objects, true);

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

        if (onObject == true) {
            canJump = true;
            console.log("onObject")
            if (moveForward) {
                moveForward = false; // Block forward movement
                velocity.z = 0; // Reset forward velocity to zero
            }
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

        if (controls.getObject().position.y < groundHeight) {

            velocity.y = 0;
            controls.getObject().position.y = groundHeight;

            canJump = true;

        }

    }

    prevTime = time;

    renderer.render(scene, camera);

}