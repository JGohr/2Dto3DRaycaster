const cellSize = 60;
const mapHeight = 10;
const mapWidth = 15;
const worldMap = Array(mapHeight * mapWidth).fill(0);
const canvas = document.getElementById('grid');
const ctx = canvas.getContext('2d');
const viewWidth = 640;
const viewHeight = 480;

let gameLoop;
let cameraX;
let fps = 60;

let maxDist = 800;

const Player = {
	position: { x: 0, y: 0 },
	direction: {x: 0, y: 0},
	mag: 0,
	mousePosition: { x: 0.0, y: 0.0 },
	mouseCell: { x: 0, y: 0 },
	velocity: { x: 0, y: 0 },
	speed: 4,
	width: cellSize / 2,
	height: cellSize / 2,
	rays: [],
	plane: {x: 0, y: 0.66},
};

function createRay()
{
	return {
		position: { x: 0, y: 0 },
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
	};
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
	
		//Calculates the magnitude of the ray
		Ray.mag = Math.sqrt(Math.pow(Ray.position.x - Player.mousePosition.x, 2) + Math.pow(Ray.position.y - Player.mousePosition.y, 2));
	
		/*
			Since we are using each ray to render a column of pixels on the screen,
			we need to cast n rays (n = the viewports width) each with a slightly different angle 
			to create a FOV (Field of View).

			Don't quite understand the implication of the plane just yet so....
			We will get back to that.

		*/
		cameraX = 2 * r / viewWidth - 1;
		Ray.direction.x = Player.direction.x + Player.plane.x * cameraX;
		Ray.direction.y = Player.direction.y + Player.plane.y * cameraX;
	
		/* unitStepSize is a vector containing scalar values for the ray given its slope.
		This value can be used to find the magnitude of a vector per unit movement along each axis.
		The approach to this step size calculation was used from lodev.org/raycasting */
		Ray.unitStepSize.x = (Math.abs(1 / Ray.direction.x));
		Ray.unitStepSize.y = (Math.abs(1 / Ray.direction.y));
	
		/*
			Priming the RayLength1D property 
	
			We need to prime the RayLength property to prepare for incrementing by a cell size.
			This can be done by checking the position of the ray in a given cell & storing the initial length
			to the nearest relative cell (This cell varies on the direction of the vector)
	
			Since the movement per unit doesn't change as long as our slope stays the same, we do this calc
			to 'align' our inital lengths with the cooresponding axis
		*/
	
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
		}
	}
}

function updatePlayerProps() {
	Player.position.x += Player.velocity.x * Player.speed;
	Player.position.y += Player.velocity.y * Player.speed;

	Player.mag = Math.sqrt(Math.pow(Player.position.x - Player.mousePosition.x, 2) + Math.pow(Player.position.y - Player.mousePosition.y, 2));

	Player.direction.x = ((Player.mousePosition.x - Player.position.x) / Player.mag);
	Player.direction.y = ((Player.mousePosition.y - Player.position.y) / Player.mag);
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
		}
		else
		{
			Ray.hitDist = Ray.Length1D.y;
			Ray.Length1D.y += Ray.unitStepSize.y * cellSize;
			Ray.cellToCheck.y += Ray.stepDirection.y;
		}
	
		if(worldMap[Ray.cellToCheck.y * mapWidth + Ray.cellToCheck.x] == 1)
		{
			Ray.hit = true;
		}
	}
}

// Changes the worldMap array value to 1 on click 
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
	} else if (e.type == 'keyup') {
		if (e.code == 'KeyW') Player.velocity.y = 0;
		if (e.code == 'KeyS') Player.velocity.y = 0;
		if (e.code == 'KeyD') Player.velocity.x = 0;
		if (e.code == 'KeyA') Player.velocity.x = 0;
	}
}

function renderRaycasts() {}

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
	for(r in Player.rays)
	{
		let Ray = Player.rays[r];
		ctx.beginPath();

		let tmpX = Ray.position.x;
		tmpX += Ray.direction.x * Ray.hitDist;

		let tmpY = Ray.position.y;
		tmpY += Ray.direction.y * Ray.hitDist;

		ctx.moveTo(Ray.position.x, Ray.position.y);
		ctx.lineTo(tmpX, tmpY);
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

function drawDebugValues() {}

function Init() {
	canvas.width = cellSize * mapWidth;
	canvas.height = cellSize * mapHeight;

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
}

function Render() {
	drawMap();
	drawPlayer();
	drawRay();
	//drawDebugValues();
	drawCollision();
	//renderRaycasts()
}

window.addEventListener('load', () => {
	Init();
	gameLoop = setInterval(() => {
		Update();
		Render();
	}, 1000 / fps);
});
