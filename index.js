const cellSize = 60;
const mapHeight = 10;
const mapWidth = 15;
const worldMap = Array(mapHeight * mapWidth).fill(0);

const canvas = document.getElementById('grid');
const ctx = canvas.getContext('2d');

const renderCanvas = document.getElementById('render');
const renderCtx = renderCanvas.getContext('2d');

const viewWidth = 640;
const viewHeight = 480;

let gameLoop;
let fps = 60;
let maxDist = 450;
let fov = 60;

const Player = {
	position: { x: 0, y: 0 },
	direction: {x: 0, y: -1},
	mag: 0,
	endPoint: {x: 0, y: 0},
	mousePosition: { x: 0.0, y: 0.0 },
	mouseCell: { x: 0, y: 0 },
	velocity: { x: 0, y: 0 },
	speed: 4,
	width: cellSize / 2,
	height: cellSize / 2,
	rays: [],
	rotationState: '',
};

let lines = [];

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
		side: 0,
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

function updateRayProps() {

	for(r in Player.rays)
	{
		let Ray = Player.rays[r];

		Ray.position = Player.position;

		//Current cell that the ray stays withing ex: (1, 5)
		Ray.currentCell.x = parseInt(Player.position.x / cellSize);
		Ray.currentCell.y = parseInt(Player.position.y / cellSize);
	
		/* Used to increment via a step value to check for collision */
		Ray.cellToCheck = Ray.currentCell;
	
		/* A floating point value of how much the ray position lays within a cell (0.0 - 0.99) */ 
		Ray.posRelToCell.x = ((Ray.position.x - cellSize * Ray.currentCell.x) / cellSize);
		Ray.posRelToCell.y = ((Ray.position.y - cellSize * Ray.currentCell.y) / cellSize);

		/* unitStepSize is a vector containing scalar values for the ray given its slope.
		This value can be used to find the magnitude of a vector per unit movement along each axis.
		The approach to this step size calculation was used from lodev.org/raycasting */
		Ray.unitStepSize.x = (Math.abs(1 / Ray.direction.x));
		Ray.unitStepSize.y = (Math.abs(1 / Ray.direction.y));

		//Creating angle offsets for all raysto create FOV

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
		{
			Ray.direction.x = Ray.direction.x - parseInt(Ray.direction.x);
		}

		if(Ray.direction.y > 1 || Ray.direction.y < -1)
		{
			Ray.direction.y = Ray.direction.y - parseInt(Ray.direction.y);
		}
	
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
	
		if(!isNaN(Ray.Length1D.x) && !isNaN(Ray.Length1D.y))
		{
			checkForCollision(Ray);
			if(!Ray.hit)
			{
				Ray.hitDist = 0;
			}
		}

		if(Ray.hitDist > 0)
		{
			Ray.mag = Ray.hitDist;
		}
		else
		{
			Ray.mag = maxDist;
		}

		Ray.endPoint = rayEndPoint(Ray);
	}
}

function updateRaycasts()
{
	for(r in Player.rays)
	{
		let Ray = Player.rays[r];

		Ray.renderDist = Ray.hitDist * Math.cos(Ray.angleFromPlayer);
	}
}

function updatePlayerProps() {
	Player.position.x += Player.velocity.x * Player.speed;
	Player.position.y += Player.velocity.y * Player.speed;

	Player.mag = 1;

	Player.endPoint = rayEndPoint(Player);
}

/*
	checkForCollision will be called once per frame as long as the init Length.x and .y values are not NaN,
	this can most likely be prevent by adding some basic border detection but for now this is the working functionality

	This entire proccess relies on comparing the tow lengths for each unit of movement (using the scalar values from above)
	We will increment one unit of movement until we find a collision or reach the max distance for detection
*/

function checkForCollision(Ray) 
{
	Ray.hitDist = 0.0;
	Ray.hit = false;

	//Collision check code here.
	while(!Ray.hit && Ray.hitDist < maxDist)
	{
		if(Ray.Length1D.x < Ray.Length1D.y)
		{
			Ray.hitDist = Ray.Length1D.x;
			Ray.Length1D.x += Ray.unitStepSize.x * cellSize;
			Ray.cellToCheck.x += Ray.stepDirection.x;
			Ray.side = 0;
		}
		else
		{
			Ray.hitDist = Ray.Length1D.y;
			Ray.Length1D.y += Ray.unitStepSize.y * cellSize;
			Ray.cellToCheck.y += Ray.stepDirection.y;
			Ray.side = 1;
		}
	
		if(worldMap[Ray.cellToCheck.y * mapWidth + Ray.cellToCheck.x] == 1)
		{
			Ray.hit = true;
		}
	}
}

function updateWorldMap() {
	worldMap[parseInt(Player.mouseCell.y) * mapWidth + parseInt(Player.mouseCell.x)] = 1;
}

function updateMousePosition(e) {
	let canvasRect = canvas.getBoundingClientRect();
	let tmpMousePos = {
		x: (e.clientX - canvasRect.left).toFixed(1),
		y: (e.clientY - canvasRect.top).toFixed(1),
	};

	let tmpMouseCell = {
		x: ((e.clientX - canvasRect.left) / cellSize).toFixed(1),
		y: ((e.clientY - canvasRect.top) / cellSize).toFixed(1),
	};

	Player.mousePosition = tmpMousePos;
	Player.mouseCell = tmpMouseCell;
}

function handlePlayerInput(e) {
	if (e.type == 'keydown') {
		if (e.code == 'KeyW') Player.velocity.y = -1;
		if (e.code == 'KeyS') Player.velocity.y = 1;
		if (e.code == 'KeyD') Player.velocity.x = 1;
		if (e.code == 'KeyA') Player.velocity.x = -1;

		let rotSpeed = .05;
		if(e.code == 'ArrowLeft')
		{
			let oldPlayerDirectionX = Player.direction.x;
			Player.direction.x = (Player.direction.x * Math.cos(-rotSpeed) - Player.direction.y * Math.sin(-rotSpeed)) / Player.mag;
			Player.direction.y = (oldPlayerDirectionX * Math.sin(-rotSpeed) + Player.direction.y * Math.cos(-rotSpeed)) / Player.mag;
			Player.rotationState = 'cc';
		}

		if(e.code == 'ArrowRight')
		{
			let oldPlayerDirectionX = Player.direction.x;
			Player.direction.x = (Player.direction.x * Math.cos(rotSpeed) - Player.direction.y * Math.sin(rotSpeed)) / Player.mag;
			Player.direction.y = (oldPlayerDirectionX * Math.sin(rotSpeed) + Player.direction.y * Math.cos(rotSpeed)) / Player.mag;
			Player.rotationState = 'c';
		}
	} else if (e.type == 'keyup') {
		if (e.code == 'KeyW') Player.velocity.y = 0;
		if (e.code == 'KeyS') Player.velocity.y = 0;
		if (e.code == 'KeyD') Player.velocity.x = 0;
		if (e.code == 'KeyA') Player.velocity.x = 0;
	}
}

function renderRaycasts() 
{
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
			if(Ray.side == 0)
			{
				renderCtx.fillStyle = '#0072bb';
			}
			else if(Ray.side == 1)
			{
				renderCtx.fillStyle = '#f945c0';
			}

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
	ctx.arc(
		Player.position.x,
		Player.position.y,
		10,
		0,
		2 * Math.PI
	);
	ctx.fill();
}

function drawRay() {
	ctx.strokeStyle = '#54ff00';
	let tmp = [Player.rays[0]];
	for(r in Player.rays)
	{
		let Ray = Player.rays[r];
		ctx.beginPath();
	
		let tmpX = Ray.position.x;
		let tmpY = Ray.position.y;

		if(Ray.hitDist > 0)
		{
			tmpX += Ray.direction.x * Ray.hitDist;
			tmpY += Ray.direction.y * Ray.hitDist;
		}
		else
		{
			tmpX += Ray.direction.x * maxDist;
			tmpY += Ray.direction.y * maxDist;
		}
	
		ctx.moveTo(Ray.position.x, Ray.position.y);
		ctx.lineTo(tmpX, tmpY);
		ctx.stroke();
	}

	ctx.beginPath();
	ctx.moveTo(Player.position.x, Player.position.y);
	ctx.lineTo(Player.position.x + (Player.direction.x * 100), Player.position.y + (Player.direction.y * 100));
	ctx.stroke();
}

function drawCollision()
{
	for(r in Player.rays)
	{
		let Ray = Player.rays[r];

		if(Ray.hit)
		{
			let x = Ray.position.x;
			x += Ray.direction.x * Ray.hitDist;
		
			let y = Ray.position.y;
			y += Ray.direction.y * Ray.hitDist;
		
			ctx.fillStyle = '#FE2836';
			ctx.beginPath();
			ctx.arc(x, y, 3, 0, 2 * Math.PI);
			ctx.fill();
		}
	}
}

function drawDebugValues() {
	document.getElementById('mouse').innerHTML = `Player Dir: { ${Player.direction.x.toFixed(2)}, ${Player.direction.y.toFixed(2)}}`;
}

function Init() {
	canvas.width = cellSize * mapWidth;
	canvas.height = cellSize * mapHeight;

	renderCanvas.width = viewWidth;
	renderCanvas.height = viewHeight;

	window.addEventListener('keydown', (e) => {
		handlePlayerInput(e);
	});

	window.addEventListener('keyup', (e) => {
		handlePlayerInput(e);
	});

	window.addEventListener('mousemove', (e) => {
		updateMousePosition(e);
	});

	canvas.addEventListener('mousedown', (e) => {
		updateWorldMap(e, canvas);
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
	updatePlayerProps();
	updateRayProps();
	updateRaycasts();
}

function Render() {
	drawMap();
	drawPlayer();
	drawRay();
	drawCollision();
	renderRaycasts();
}

window.addEventListener('load', () => {
	Init();
	gameLoop = setInterval(() => {
		Update();
		Render();
	}, 1000 / fps);
});

/*
	LOOP ORDER:

			Clear Screen

			updatePlayerProps();

			updateRayProps();

			updateRaycasts();

			drawMap();

			drawPlayer();

			drawRay();

			drawDebugValues();

			drawCollision();

			renderRaycasts();
*/
