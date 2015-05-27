Physijs.scripts.worker = 'js/physijs_worker.js';
Physijs.scripts.ammo = 'ammo.js';

var renderer, render_stats, physics_stats, scene, light, camera, vehicle;

var initScene = function() {
	var mainContaier = document.getElementById('main');
	
	// scene renderer
	renderer = new THREE.WebGLRenderer({antialias: true});
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.shadowMapEnabled = true;
	renderer.shadowMapSoft = true;
	mainContaier.appendChild(renderer.domElement);

	// fps stats
	render_stats = new Stats();
	render_stats.domElement.style.position = 'absolute';
	render_stats.domElement.style.top = '1px';
	render_stats.domElement.style.zIndex = 100;
	mainContaier.appendChild(render_stats.domElement);
	physics_stats = new Stats();
	physics_stats.domElement.style.position = 'absolute';
	physics_stats.domElement.style.top = '50px';
	physics_stats.domElement.style.zIndex = 100;
	mainContaier.appendChild(physics_stats.domElement);
	
	// scene
	scene = new Physijs.Scene;
	scene.setGravity(new THREE.Vector3(0, -30, 0));
	
	// camera
	camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 1, 1000);
	camera.lookAt(scene.position);
	camera.rotation.y = 180 * Math.PI / 180;
	camera.position.add(new THREE.Vector3(0, 5, -35));

	// light
	light = new THREE.DirectionalLight(0xFFFFFF);
	light.position.set(20, 20, -15);
	light.target.position.copy(scene.position);
	light.castShadow = true;
	light.shadowCameraLeft = -150;
	light.shadowCameraTop = -150;
	light.shadowCameraRight = 150;
	light.shadowCameraBottom = 150;
	light.shadowCameraNear = 20;
	light.shadowCameraFar = 400;
	light.shadowBias = -.0001
	light.shadowMapWidth = light.shadowMapHeight = 2048;
	light.shadowDarkness = .7;
	scene.add(light);


	createGround();
	createVehicle();
	// make 50 boxes
	for (i = 0; i < 50; i++) {
		createBoxes();
	}

	controls();
	requestAnimationFrame(render);
	scene.simulate();
};


// renders the scene
var render = function() {
	requestAnimationFrame(render);
	if (vehicle) {
		vehicle.mesh.add(camera);

		light.target.position.copy(vehicle.mesh.position);
		light.position.addVectors(light.target.position, new THREE.Vector3(20, 20, -15));
	}
	renderer.render(scene, camera);
	render_stats.update();
};


// handles keyboard controls
var controls = function() {

	var input = {
		power: null,
		direction: null,
		steering: 0
	};

	// keyboard controls
	document.addEventListener('keydown', function(e) {
		switch (e.keyCode) {
			case 37: // left key
				input.direction = 1;
				break;

			case 38: // up key
				input.power = true;
				break;

			case 39: // right key
				input.direction = -1;
				break;

			case 40: // down key
				input.power = false;
				break;
		}
	});

	document.addEventListener('keyup', function(e) {
		switch (e.keyCode) {
			case 37: // left key
				input.direction = null;
				break;

			case 38: // up key
				input.power = null;
				break;

			case 39: // right key
				input.direction = null;
				break;

			case 40: // down key
				input.power = null;
				break;
		}
	});


	// listen for controls
	scene.addEventListener('update', function() {
		if (input && vehicle) {
			if (input.direction !== null) {
				// set steering
				input.steering += input.direction / 50;
				if (input.steering < -.6) input.steering = -.6;
				if (input.steering > .6) input.steering = .6;
			} else {
				// ease out steering back straight
				if ( input.steering > 0 ) {
					input.steering = THREE.Math.clamp( input.steering - 0.016 * 1, 0, 0.6 );
				} else {
					input.steering = THREE.Math.clamp( input.steering + 0.016 * 1, -0.6, 0 );
				}
			}
			vehicle.setSteering(input.steering, 0);
			vehicle.setSteering(input.steering, 1);

			// set throttle
			if (input.power === true) {
				vehicle.applyEngineForce(500);
			} else if (input.power === false) {
				vehicle.setBrake(20, 1);
				vehicle.setBrake(40, 2);
				vehicle.setBrake(40, 3);
				vehicle.setBrake(20, 4);
			} else {
				vehicle.applyEngineForce(0);
			}
		}

		scene.simulate(undefined, 2);
		physics_stats.update();
	});
};




// loads meshes and materials and creates a vehicle toghether with all 4 wheels
var createVehicle = function() {
	var loader = new THREE.JSONLoader();
	loader.load("models/mustang.js", function(car, car_materials) {
		loader.load("models/mustang_wheel.js", function(wheel_geometry, wheel_materials) {

			// create car mesh
			var carMesh = new Physijs.BoxMesh(car, new THREE.MeshFaceMaterial(car_materials));
			carMesh.position.y = 5;
			carMesh.castShadow = carMesh.receiveShadow = true;

			// create a new vehicle with car mesh
			var suspension_stiffness = 20.88;
			var suspension_compression = 5.83;
			var suspension_damping = 10.28;
			var max_suspension_travel = 300;
			var friction_slip = 10.5;
			var max_suspension_force= 3000;

			vehicle = new Physijs.Vehicle(carMesh, new Physijs.VehicleTuning(suspension_stiffness, suspension_compression, suspension_damping, max_suspension_travel, friction_slip, max_suspension_force));
			scene.add(vehicle);
			window.vehicle = vehicle;
			window.scene = scene;



			// create all 4 wheels
			var wheel_material = new THREE.MeshFaceMaterial(wheel_materials);
			var wheel_direction = new THREE.Vector3(0, -1, 0);
			var wheel_axle = new THREE.Vector3(-1, 0, 0);
			var suspension_rest_length = 0.5;
			var wheel_radius = 0.7;

			for (var i = 0; i < 4; i++) {
				vehicle.addWheel(
					wheel_geometry,
					wheel_material,
					new THREE.Vector3(i % 2 === 0 ? -1.6 : 1.6, -1, i < 2 ? 3.3 : -3.2), // connection_point
					wheel_direction,
					wheel_axle,
					suspension_rest_length,
					wheel_radius,
					i < 2 ? false : true // is_wheel_front
				);
			}
		});
	});
}


var createGround = function() {
	// Ground
	var NoiseGen = new SimplexNoise;

	var ground_material = Physijs.createMaterial(
		new THREE.MeshLambertMaterial({map: THREE.ImageUtils.loadTexture('images/rocks.jpg')}),
		.8, // high friction
		.4 // low restitution
	);
	ground_material.map.wrapS = ground_material.map.wrapT = THREE.RepeatWrapping;
	ground_material.map.repeat.set(3, 3);

	var ground_geometry = new THREE.PlaneGeometry(300, 300, 100, 100);
	for (var i = 0; i < ground_geometry.vertices.length; i++) {
		var vertex = ground_geometry.vertices[i];
		// console.log( NoiseGen.noise( vertex.x / 30, vertex.z / 30 ) * 1);
		// vertex.y = NoiseGen.noise( vertex.x / 30, vertex.z / 30 ) * 1;
	}
	ground_geometry.computeFaceNormals();
	ground_geometry.computeVertexNormals();

	// If your plane is not square as far as face count then the HeightfieldMesh
	// takes two more arguments at the end: # of x faces and # of z faces that were passed to THREE.PlaneMaterial
	var ground = new Physijs.HeightfieldMesh(
			ground_geometry,
			ground_material,
			0 // mass
	);
	ground.rotation.x = -Math.PI / 2;
	ground.receiveShadow = true;
	scene.add(ground);
}


var createBoxes = function() {
	var box_material = Physijs.createMaterial(
		new THREE.MeshLambertMaterial({map: THREE.ImageUtils.loadTexture('images/plywood.jpg')}),
		.4, // low friction
		.6 // high restitution
	);
	box_material.map.wrapS = box_material.map.wrapT = THREE.RepeatWrapping;
	box_material.map.repeat.set(.25, .25);

	var size = Math.random() * 2 + .5;
	var box = new Physijs.BoxMesh(
		new THREE.CubeGeometry(size, size, size),
		box_material
	);
	box.castShadow = box.receiveShadow = true;
	box.position.set(Math.random() * 25 - 50, 5, Math.random() * 25 - 50);
	scene.add(box)
}

// load scene
window.onload = initScene;