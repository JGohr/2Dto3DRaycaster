const cellSize = 60;
const mapHeight = 10;
const mapWidth = 10;
const worldMap = Array(mapHeight * mapWidth).fill(0);
const canvas = document.getElementById('grid');
const ctx = canvas.getContext('2d');
const renderCanvas = document.getElementById('render');
const renderCtx = renderCanvas.getContext('2d');
const viewWidth = 640;
const viewHeight = 480;
let gameLoop;
let fps = 60;
let maxDist = 600;
let fov = 60;

const Player = {
	position: { x: 420, y: 280 },
	direction: {x: 0, y: -1},
	mag: 1,
	radius: 10,
	endPoint: {x: 0, y: 0},
	mousePosition: { x: 0.0, y: 0.0 },
	mouseCell: { x: 0, y: 0 },
	velocity: { x: 0, y: 0 },
	speed: 4,
	rotSpeed: .07,
	rays: [],
	rotationState: '',
};

const inputController = {
	'KeyW': {pressed: false, fn: function(){
		let projPosX = Player.position.x + Player.direction.x * Player.speed;
		let projPosY = Player.position.y + Player.direction.y * Player.speed;
		let projCell = {x: parseInt(projPosX / cellSize), y: parseInt(projPosY / cellSize)};

		if((projPosX > 0 && projPosX < mapWidth * cellSize) && (projPosY > 0 && projPosY < mapHeight * cellSize) && worldMap[Math.abs(projCell.y) * mapWidth + Math.abs(projCell.x)] != 1)
		{
			Player.position.x = projPosX;
			Player.position.y = projPosY;
		}
	}},
	'KeyA': {pressed: false, fn: function(){
		//Move Left relative to direction
		let newDir = rotateVector(Player.direction, degToRadians(-90));
		let projCell = {x: parseInt(newDir.x / cellSize), y: parseInt(newDir.y / cellSize)};

		let projectedX = Player.position.x + (newDir.x * Player.speed);
		let projectedY = Player.position.y + (newDir.y * Player.speed);

		if((projectedX > 0 && projectedX < mapWidth * cellSize) && (projectedY > 0 && projectedY < mapHeight * cellSize) && worldMap[Math.abs(projCell.y) * mapWidth + Math.abs(projCell.x)] != 1)
		{
			Player.position.x = projectedX;
			Player.position.y = projectedY;
		}
	}},
	'KeyS': {pressed: false, fn: function(){
		let projPosX = Player.position.x - Player.direction.x * Player.speed;
		let projPosY = Player.position.y - Player.direction.y * Player.speed;
		let projCell = {x: parseInt(projPosX / cellSize), y: parseInt(projPosY / cellSize)};

		if((projPosX > 0 && projPosX < mapWidth * cellSize) && (projPosY > 0 && projPosY < mapHeight * cellSize) && worldMap[Math.abs(projCell.y) * mapWidth + Math.abs(projCell.x)] != 1)
		{
			Player.position.x = projPosX;
			Player.position.y = projPosY;
		}
	}},
	'KeyD': {pressed: false, fn: function(){
		//Move right relative to direction
		let newDir = rotateVector(Player.direction, degToRadians(90));
		let projCell = {x: parseInt(newDir.x / cellSize), y: parseInt(newDir.y / cellSize)};

		let projectedX = Player.position.x + (newDir.x * Player.speed);
		let projectedY = Player.position.y + (newDir.y * Player.speed);

		if((projectedX > 0 && projectedX < mapWidth * cellSize) && (projectedY > 0 && projectedY < mapHeight * cellSize) && worldMap[Math.abs(projCell.y) * mapWidth + Math.abs(projCell.x)] != 1)
		{
			Player.position.x = projectedX;
			Player.position.y = projectedY;
		}

	}},
	'ArrowLeft': {pressed: false, fn: function(){
		let oldPlayerDirectionX = Player.direction.x;
		Player.direction.x = (Player.direction.x * Math.cos(-Player.rotSpeed) - Player.direction.y * Math.sin(-Player.rotSpeed)) / Player.mag;
		Player.direction.y = (oldPlayerDirectionX * Math.sin(-Player.rotSpeed) + Player.direction.y * Math.cos(-Player.rotSpeed)) / Player.mag;
		Player.rotationState = 'cc';
	}},
	'ArrowRight': {pressed: false, fn: function(){
		let oldPlayerDirectionX = Player.direction.x;
		Player.direction.x = (Player.direction.x * Math.cos(Player.rotSpeed) - Player.direction.y * Math.sin(Player.rotSpeed)) / Player.mag;
		Player.direction.y = (oldPlayerDirectionX * Math.sin(Player.rotSpeed) + Player.direction.y * Math.cos(Player.rotSpeed)) / Player.mag;
		Player.rotationState = 'c';
	}},
}

function createRay()
{
	return {
		position: { x: 0, y: 0 },
		endPoint: {x: 0, y: 0},
		posRelToCell: { x: 0.0, y: 0.0 },
		mag: 0,
		direction: { x: 0.0, y: 0.0 },
		unitStepSize: { x: 0, y: 0 },
		currentCell: { x: 0, y: 0 },
		cellToCheck: { x: 0, y: 0 },
		Length1D: { x: 0, y: 0 },
		stepDirection: { x: 0, y: 0 },
		hit: false,
		hitDist: 0,
		renderDist: 0,
		sideHit: 0,
		angleFromPlayer: 0,
	};
}

function degToRadians(deg)
{
	return deg * (Math.PI / 180);
}

function rayEndPoint(ray)
{
	if(ray.mag > 0)
		return {x: ray.position.x + (ray.direction.x * ray.mag), y: ray.position.y + (ray.direction.y * ray.mag)};

	if(ray.mag <= 0)
		return {x: ray.position.x + (ray.direction.x * ray.maxDist), y: ray.position.y + (ray.direction.y * ray.maxDist)};
}

function getDotProduct(v1, v2)
{
	return (v1.endPoint.x * v2.endPoint.x) + (v1.endPoint.y * v2.endPoint.y);
}

function rotateVector(v, radian)
{
	let newVector = {x: 0, y: 0};

	newVector.x = v.x * Math.cos(radian) - v.y * Math.sin(radian);
	newVector.y = v.x * Math.sin(radian) + v.y * Math.cos(radian);

	return newVector;
}

function updateRayProps() {

	for(r in Player.rays)
	{
		let Ray = Player.rays[r];

		Ray.position = Player.position;

		//Current cell that the rays position is in, casted to integer to remove floating point
		Ray.currentCell.x = parseInt(Player.position.x / cellSize);
		Ray.currentCell.y = parseInt(Player.position.y / cellSize);
	
		//Storing the initial cell to check
		Ray.cellToCheck = Ray.currentCell;
	
		/* A floating point value of how much the ray position lays within a cell (0.0 - 0.99) */ 
		Ray.posRelToCell.x = ((Ray.position.x - cellSize * Ray.currentCell.x) / cellSize);
		Ray.posRelToCell.y = ((Ray.position.y - cellSize * Ray.currentCell.y) / cellSize);

		/* unitStepSize is a vector containing scalar values for the ray given its slope.
		This value can be used to find the magnitude of a vector per unit movement along each axis.
		The approach to this step size calculation was used from lodev.org/raycasting */
		Ray.unitStepSize.x = (Math.abs(1 / Ray.direction.x));
		Ray.unitStepSize.y = (Math.abs(1 / Ray.direction.y));

		/*
			There's a couple ways to approach creating a FOV for the player. Since I knew I needed viewWidth angles to fit within a given fov degree range,
			I decided to find the increment for each angle while assigning the initial angle to be -(FOV / 2).

			This way when we rotate, every angle after the initial angle will always be (rayDirStep * n) away.
		*/
		let halfFOV = degToRadians(fov / 2);

		//iAV => "Initial Angle Vector" (-30 Degrees from players direction)
		let iAVX = Player.direction.x * Math.cos(-halfFOV) - Player.direction.y * Math.sin(-halfFOV);
		let iAVY = Player.direction.x * Math.sin(-halfFOV) + Player.direction.y * Math.cos(-halfFOV);

		//Amount to rotate each ray by
		let rayDirStep = degToRadians(fov / viewWidth);

		if(r == 0)
		{
			Ray.direction.x = iAVX;
			Ray.direction.y = iAVY;
			Ray.angleFromPlayer = -halfFOV; 
		}
		else
		{
			let rotAmount = (rayDirStep * r)
			Ray.direction.x =  Player.rays[0].direction.x * Math.cos(rotAmount) - Player.rays[0].direction.y * Math.sin(rotAmount);
			Ray.direction.y =  Player.rays[0].direction.x * Math.sin(rotAmount) + Player.rays[0].direction.y * Math.cos(rotAmount);
			Ray.angleFromPlayer = -halfFOV + rotAmount; 
		}

		/*
			Priming the RayLength1D property 
	
			We need to prime the RayLength property to prepare for incrementing by a cell size.
			This can be done by checking the position of the ray in a given cell & storing the initial length
			to the nearest relative cell (This cell varies on the direction of the vector)
	
			Since the movement per unit doesn't change as long as our slope stays the same, we do this calc
			to 'align' our inital lengths with the cooresponding axis
		*/

		if(Ray.direction.x > 1 || Ray.direction.x < -1)
			Ray.direction.x = Ray.direction.x - parseInt(Ray.direction.x);

		if(Ray.direction.y > 1 || Ray.direction.y < -1)
			Ray.direction.y = Ray.direction.y - parseInt(Ray.direction.y);
	
		if(Ray.direction.x < 0)
		{
			Ray.stepDirection.x = -1;
			Ray.Length1D.x = (cellSize * Ray.posRelToCell.x) * Ray.unitStepSize.x;
		}
		else
		{
			Ray.stepDirection.x = 1;
			Ray.Length1D.x = ((1.0 - Ray.posRelToCell.x) * cellSize) * Ray.unitStepSize.x;
		}
	
		if(Ray.direction.y < 0)
		{
			Ray.stepDirection.y = -1;
			Ray.Length1D.y = (cellSize * Ray.posRelToCell.y) * Ray.unitStepSize.y;
		}
		else
		{
			Ray.stepDirection.y = 1;
			Ray.Length1D.y = ((1.0 - Ray.posRelToCell.y) * cellSize) * Ray.unitStepSize.y;
		}
	
		/*
			During the initial spawn of the player, the ray lengths could be defaulted to NaN due to the positioning
			of the player. I defaulted the players spawn offset to be centered but left the conditional just in case.
		
			Lastly, we call checkForCollision(). This performs the DDA operation for each ray, adjusting the hitDist during the proccess.
			Using this hitDist, we can multiply its value by the Ray.angleFromPlayer which we stored previously in the FOV setup. 

			This will remove the fisheye effect seen in a ton of raycasters.
		*/

		if(!isNaN(Ray.Length1D.x) && !isNaN(Ray.Length1D.y))
		{
			checkForCollision(Ray);
			if(!Ray.hit)
			{
				Ray.hitDist = 0;

				if(Ray.hitDist > 0)
					Ray.mag = Ray.hitDist;
				else
					Ray.mag = maxDist;
			}
		}

		Ray.endPoint = rayEndPoint(Ray);
		Ray.renderDist = Ray.hitDist * Math.cos(Ray.angleFromPlayer);
	}
}

function callInputController() {
	Object.keys(inputController).forEach(key => {
		if(inputController[key].pressed)
			inputController[key].fn();
	});
}

function updatePlayerProps() {
	Player.endPoint = rayEndPoint(Player);
}

/*
	checkForCollision will be called once per frame as long as the init Length.x and .y values are not NaN.

	This entire proccess relies on comparing the two lengths for each unit of movement along a given axis (using Ray.unitStepSize.(x OR y)).
	We will increment one unit of movement until we find a collision or reach the max distance for detection
*/

function checkForCollision(Ray) 
{
	Ray.hitDist = 0.0;
	Ray.hit = false;

	while(!Ray.hit && Ray.hitDist < maxDist)
	{
		if(Ray.Length1D.x < Ray.Length1D.y)
		{
			Ray.hitDist = Ray.Length1D.x;
			Ray.Length1D.x += Ray.unitStepSize.x * cellSize;
			Ray.cellToCheck.x += Ray.stepDirection.x;
			Ray.sideHit = 0;
		}
		else
		{
			Ray.hitDist = Ray.Length1D.y;
			Ray.Length1D.y += Ray.unitStepSize.y * cellSize;
			Ray.cellToCheck.y += Ray.stepDirection.y;
			Ray.sideHit = 1;
		}
	
		if(worldMap[Ray.cellToCheck.y * mapWidth + Ray.cellToCheck.x] == 1)
			Ray.hit = true;
	}
}

function updateMousePosition(e) {
	let canvasRect = canvas.getBoundingClientRect();
	let tmpMousePos = {
		x: (e.clientX - canvasRect.left),
		y: (e.clientY - canvasRect.top),
	};

	let tmpMouseCell = {
		x: ((e.clientX - canvasRect.left) / cellSize),
		y: ((e.clientY - canvasRect.top) / cellSize),
	};

	Player.mousePosition = tmpMousePos;
	Player.mouseCell = tmpMouseCell;
}

function renderRaycasts() 
{
	// Drawing the background first is MANDATORY to prevent a distortion effect on the scene
	for(r in Player.rays)
	{
		renderCtx.fillStyle = '#96c8a2';
		renderCtx.fillRect(r, 0, 1, viewHeight / 2);
		renderCtx.fillStyle = '#e9cbff';
		renderCtx.fillRect(r, viewHeight / 2, 1, viewHeight);

		let Ray = Player.rays[r];

		let lineHeight = (viewHeight / Ray.renderDist) * cellSize;

		if(lineHeight > viewHeight)
			lineHeight = viewHeight;

		if(Ray.hit)
		{
			if(Ray.sideHit == 0)
				renderCtx.fillStyle = '#0072bb';
			else if(Ray.sideHit == 1)
				renderCtx.fillStyle = '#f945c0';

			renderCtx.fillRect(r, viewHeight / 2 - lineHeight / 2, 1, lineHeight);
		}
	}

	renderCtx.clearRect(0, 0, renderCtx.width, renderCtx.height);
}

function drawMap() {
	ctx.strokeStyle = '#FFFFFF';

	for (let y = 0; y < mapHeight; y++) {
		for (let x = 0; x < mapWidth; x++) {
			switch (worldMap[y * mapWidth + x]) {
				case 0:
					ctx.fillStyle = '#000000';
					break;
				case 1:
					ctx.fillStyle = '#0023E5';
					break;
			}

			ctx.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
			ctx.strokeRect(x * cellSize, y * cellSize, cellSize, cellSize);
		}
	}
}

function drawPlayer() {
	ctx.fillStyle = '#9734FF';
	ctx.beginPath();
	ctx.arc(Player.position.x, Player.position.y, Player.radius, 0, 2 * Math.PI);
	ctx.fill();
}

function drawRay() {
	ctx.strokeStyle = '#54ff00';
	for(r in Player.rays)
	{
		let Ray = Player.rays[r];
		ctx.beginPath();
	
		let x = Ray.position.x;
		let y = Ray.position.y;

		if(Ray.hitDist > 0)
		{
			x += Ray.direction.x * Ray.hitDist;
			y += Ray.direction.y * Ray.hitDist;
		}
		else
		{
			x += Ray.direction.x * maxDist;
			y += Ray.direction.y * maxDist;
		}
	
		ctx.moveTo(Ray.position.x, Ray.position.y);
		ctx.lineTo(x, y);
		ctx.stroke();
	}
}

function drawCollision()
{
	for(r in Player.rays)
	{
		let Ray = Player.rays[r];

		if(Ray.hit)
		{
			let xPrime = Ray.position.x;
			xPrime += Ray.direction.x * Ray.hitDist;
		
			let yPrime = Ray.position.y;
			yPrime += Ray.direction.y * Ray.hitDist;
		
			ctx.fillStyle = '#FE2836';
			ctx.beginPath();
			ctx.arc(xPrime, yPrime, 3, 0, 2 * Math.PI);
			ctx.fill();
		}
	}
}

function Init() {
	canvas.width = cellSize * mapWidth;
	canvas.height = cellSize * mapHeight;

	renderCanvas.width = viewWidth;
	renderCanvas.height = viewHeight;

	window.addEventListener('keydown', (e) => {
		if(inputController[e.code])
			inputController[e.code].pressed = true;
	});

	window.addEventListener('keyup', (e) => {
		if(inputController[e.code])
			inputController[e.code].pressed = false;
	});

	window.addEventListener('mousemove', (e) => {
		updateMousePosition(e);
	});

	canvas.addEventListener('mousedown', (e) => {
		worldMap[parseInt(Player.mouseCell.y) * mapWidth + parseInt(Player.mouseCell.x)] = 1;
	});

	document.getElementById('reset').addEventListener('click', () => {
		worldMap.fill(0);
	});

	for(i = 0; i < viewWidth; i++)
	{
		Player.rays.push(createRay());
	}
}

function Update() {
	callInputController();
	updatePlayerProps();
	updateRayProps();
}

function Render() {
	drawMap();
	drawPlayer();
	drawRay();
	drawCollision();
	renderRaycasts();
	document.getElementById('misc').innerHTML = `${Player.direction.x.toFixed(2)}, ${Player.direction.y.toFixed(2)}`;
}

window.addEventListener('load', () => {
	Init();
	gameLoop = setInterval(() => {
		Update();
		Render();
	}, 1000 / fps);
});