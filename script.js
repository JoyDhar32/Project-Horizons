
import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';
import { createNoise2D } from 'simplex-noise';

import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { GLTFLoader } from 'three/examples/jsm/Addons.js';

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

const boxGeometry = new THREE.BoxGeometry(20, 20, 20).toNonIndexed();
const boxMaterial = new THREE.MeshPhongMaterial({ specular: 'purple', flatShading: true, vertexColors: true });
boxMaterial.color.setHSL(Math.random() * 0.2 + 0.5, 0.75, Math.random() * 0.25 + 0.75, THREE.SRGBColorSpace);
const sphereGeometry = new THREE.SphereGeometry(5, 48, 48); // Adjust radius, segments for smoothness
const sphereMaterial = new THREE.MeshBasicMaterial({ color: '#9D941B' }); // Set a single color
const cylinderGeometry = new THREE.CylinderGeometry(8, 8, 8, 64); // Adjust radius top/bottom, height, segments for smoothness
const cylinderMaterial = new THREE.MeshBasicMaterial({ color: 'orange' });
boxGeometry.computeBoundsTree();
sphereGeometry.computeBoundsTree();
cylinderGeometry.computeBoundsTree();

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
                const c = z + (x + 1) * (subdivisions  + 1);
                const d = (z + 1) + (x + 1) * (subdivisions  + 1);
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




        //create a loader
        const loader = new GLTFLoader();
        const models = ['model/tree.glb',
                         //'model/asia_building.glb', 
                        //'model/dog.glb',
                        //'model/horse_skeleton.glb',
                        //'model/french_house_ww2.glb',
                        //'model/wall.glb',
                        //'model/darkbeast.glb',
                    ];

        //load models
        models.forEach((modelPath, index) => {
            loader.load(
              modelPath,
              function (gltf) {
                scene.add(gltf.scene);
                // model position
                gltf.scene.position.set(100 * index, 0, 0); // set the position of the model
              },
            );
          });





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
                const raycaster = new THREE.Raycaster(new THREE.Vector3(item.position.x, 1000, item.position.z), new THREE.Vector3(0, -1, 0));
                raycaster.firstHitOnly = true;
                const intersects = raycaster.intersectObject(floor);
                if (intersects.length > 0) item.position.y = intersects[0].point.y + 10;
            }

            box.position.x = Math.random() * range * 2 - range; // Ensures values between -floorSize and floorSize
            box.position.z = Math.random() * range * 2 - range; // Ensures values between -floorSize and floorSize
            sphere.position.x = Math.random() * range * 2 - range; // Ensures values between -floorSize and floorSize
            sphere.position.z = Math.random() * range * 2 - range; // Ensures values between -floorSize and floorSize
            cylinder.position.x = Math.random() * range * 2 - range; // Ensures values between -floorSize and floorSize
            cylinder.position.z = Math.random() * range * 2 - range; // Ensures values between -floorSize and floorSize
            setY(box);
            setY(sphere);
            setY(cylinder);

            floor.add(box);
            floor.add(sphere);
            floor.add(cylinder);
            objects.push(box);
            objects.push(sphere);
            objects.push(cylinder);


            // models
            const models = ['model/tree.glb',
                        //'model/asia_building.glb', 
                        //'model/dog.glb',
                        //'model/horse_skeleton.glb',
                          //'model/french_house_ww2.glb',
                          //'model/wall.glb',
                        //'model/darkbeast.glb',
                           ];


            const objectsToReplace = [box, sphere, cylinder];

            // load 
            models.forEach((modelPath, index) => {
            loader.load(
            modelPath,
            function (gltf) {
                const model = gltf.scene.clone();
                model.position.copy(objectsToReplace[index].position);
                
                if (modelPath === 'model/tree.glb') {
                    model.scale.set(10, 10, 10);}
                    
                //if (modelPath === 'model/dog.glb') {
                //    model.scale.set(10, 10, 10);}


            floor.add(model);
            objects.push(model);
            
            
            // remove the original object
            floor.remove(objectsToReplace[index]);
            const idx = objects.indexOf(objectsToReplace[index]);
            if (idx > -1) {
                objects.splice(idx, 1);
            }
        },
        function (xhr) {
            console.log((xhr.loaded / xhr.total * 100) + '% loaded');
        },
        function (error) {
            console.log('An error happened');
        }
    );
});

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
