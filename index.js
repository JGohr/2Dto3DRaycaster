const canvas = document.getElementById('grid');
const ctx = canvas.getContext('2d');
const renderCanvas = document.getElementById('render');
const renderCtx = renderCanvas.getContext('2d');

let worldMap;

const cellSize = 60;
const mapHeight = 10;
const mapWidth = 15;
const viewWidth = 640;
const viewHeight = 480;

let fps = 60;
let maxDist = 600;
let fov = degToRadians(60);

const Player = {
	position: { x: 420, y: 280 },
	direction: {x: 0, y: -1},
	cellPosition: {x: 0, y: 0},
	currentCell: {x: 0, y: 0},
	mag: 1,
	mouseCell: { x: 0, y: 0 },
	speed: 4,
	rotSpeed: .07,
	rays: [],
};

/*
	The inputController object will be used to provide smoother feedback for keyevents related to movement of the player.
	Using regular event listeners to detect keypresses is extremely choppy and doesn't allow for multiple presses to execute functionality.

	The super long conditionals being used before the projected position is actually applied is a basic form of collision detection.
*/

const inputController = {
	'KeyW': {pressed: false, fn: function(){
		let projectedX = Player.position.x + Player.direction.x * Player.speed;
		let projectedY = Player.position.y + Player.direction.y * Player.speed;
		let projCell = {x: parseInt(projectedX / cellSize), y: parseInt(projectedY / cellSize)};

		if(playerCollisionCheck(projCell))
		{
			Player.position.x = projectedX;
			Player.position.y = projectedY;
		}
	}},
	'KeyA': {pressed: false, fn: function(){
		let newDir = rotateVector(Player.direction, degToRadians(-90));
		let projectedX = Player.position.x + (newDir.x * Player.speed);
		let projectedY = Player.position.y + (newDir.y * Player.speed);
		let projCell = {x: parseInt(projectedX / cellSize), y: parseInt(projectedY / cellSize)};

		if(playerCollisionCheck(projCell))
		{
			Player.position.x = projectedX;
			Player.position.y = projectedY;
		}
	}},
	'KeyS': {pressed: false, fn: function(){
		let projectedX = Player.position.x - Player.direction.x * Player.speed;
		let projectedY = Player.position.y - Player.direction.y * Player.speed;
		let projCell = {x: parseInt(projectedX / cellSize), y: parseInt(projectedY / cellSize)};

		if(playerCollisionCheck(projCell))
		{
			Player.position.x = projectedX;
			Player.position.y = projectedY;
		}
	}},
	'KeyD': {pressed: false, fn: function(){
		let newDir = rotateVector(Player.direction, degToRadians(90));
		let projectedX = Player.position.x + (newDir.x * Player.speed);
		let projectedY = Player.position.y + (newDir.y * Player.speed);
		let projCell = {x: parseInt(projectedX / cellSize), y: parseInt(projectedY / cellSize)};

		if(playerCollisionCheck(projCell))
		{
			Player.position.x = projectedX;
			Player.position.y = projectedY;
		}

	}},
	'ArrowLeft': {pressed: false, fn: function(){

		let newDirection = {x: 0, y: 0};

		newDirection = rotateVector(Player.direction, -Player.rotSpeed);

		newDirection.x = newDirection.x / Player.mag;
		newDirection.y = newDirection.y / Player.mag;

		Player.direction = newDirection;
	}},
	'ArrowRight': {pressed: false, fn: function(){
		let newDirection = {x: 0, y: 0};

		newDirection = rotateVector(Player.direction, Player.rotSpeed);

		newDirection.x = newDirection.x / Player.mag;
		newDirection.y = newDirection.y / Player.mag;

		Player.direction = newDirection;
	}},
	'mousedown': {pressed: false, fn: function(){
		worldMap[Player.mouseCell.y * mapWidth + Player.mouseCell.x] = 1;
	}},
}

function playerCollisionCheck(projCell)
{
	if(worldMap[projCell.y * mapWidth + projCell.x] != 1)
	{
		return true;
	}

	return false;
}

function generateMap() {

	let wm = Array(mapHeight * mapWidth).fill(0);

	for(y = 0; y < mapHeight; y++)
	{
		for(x = 0; x < mapWidth; x++)
		{
			//Generate a border around the map
			if(y == 0 || y == mapHeight - 1 || x == 0 || x == mapWidth - 1)
			{
				wm[y * mapWidth + x] = 1;
			}
		}
	}

	return wm;
}

function createRay()
{
	return {
		angleFromPlayer: 0,
		direction: { x: 0.0, y: 0.0 },
		mag: 0,
		unitStepSize: { x: 0, y: 0 },
		currentCell: { x: 0, y: 0 },
		cellToCheck: { x: 0, y: 0 },
		travelDist: { x: 0, y: 0 },
		stepDirection: { x: 0, y: 0 },
		hit: false,
		hitDist: 0,
		renderDist: 0,
		sideHit: 0,
	};
}

function degToRadians(deg)
{
	return deg * (Math.PI / 180);
}

function rotateVector(v, radian)
{
	let newVector = {x: 0, y: 0};

	newVector.x = v.x * Math.cos(radian) - v.y * Math.sin(radian);
	newVector.y = v.x * Math.sin(radian) + v.y * Math.cos(radian);

	return newVector;
}

function updateRayProps() {

	/*
		There's a couple ways to approach creating a FOV for the player. Since I knew I needed viewWidth angles to fit within a given fov degree range,
		I decided to find the increment for each angle while assigning the initial angle to be -(FOV / 2).

		This way when we rotate, every angle after the initial angle will always be (rayDirStep * n) away.

		rayDirStep = Amount (in radians) to rotate each ray by
		iAV => "Initial Angle Vector" (-30 Degrees from players direction)
	*/
	let halfFOV = fov / 2;

	let initialAngleVector = rotateVector(Player.direction, -halfFOV);

	let rayDirStep = fov / viewWidth;

	for(r in Player.rays)
	{
		let Ray = Player.rays[r];

		if(r == 0)
		{
			Ray.direction = initialAngleVector; 
			Ray.angleFromPlayer = -halfFOV; 
		}
		else
		{
			let rotAmount = (rayDirStep * r)
			Ray.direction = rotateVector(initialAngleVector, rotAmount);
			Ray.angleFromPlayer = -halfFOV + rotAmount; 
		}

		/* Each ray needs a initial cell to check, since all rays start from Player.position
		we can assign the x and y values to our players current cell */
		Ray.cellToCheck.x = Player.currentCell.x;
		Ray.cellToCheck.y = Player.currentCell.y;

		/* unitStepSize is a vector containing scalar values for the ray given its slope.
		This value can be used to find the magnitude of a vector per unit movement along each axis.
		The approach to this step size calculation was used from lodev.org/raycasting 
		
		Since this scalar value is only for 1px of movement, we multiply it by our cellSize
		variable to get the desired scale factor for this app.*/
		Ray.unitStepSize.x = (Math.abs(1 / Ray.direction.x)) * cellSize;
		Ray.unitStepSize.y = (Math.abs(1 / Ray.direction.y)) * cellSize;

		/*
			Priming the Ray travelDist property 
	
			We need to prime the RayLength property to prepare for incrementing by a cell size.
			This can be done by checking the position of the ray in a given cell & storing the initial length
			to the nearest relative cell (This cell varies on the direction of the vector)
	
			Since the movement per unit doesn't change as long as our slope stays the same, we do this calc
			to 'align' our inital lengths with the cooresponding axis
		*/
	
		if(Ray.direction.x < 0)
		{
			Ray.stepDirection.x = -1;
			Ray.travelDist.x = (Player.cellPosition.x) * Ray.unitStepSize.x;
		}
		else
		{
			Ray.stepDirection.x = 1;
			Ray.travelDist.x = (1.0 - Player.cellPosition.x) * Ray.unitStepSize.x;
		}
	
		if(Ray.direction.y < 0)
		{
			Ray.stepDirection.y = -1;
			Ray.travelDist.y = (Player.cellPosition.y) * Ray.unitStepSize.y;
		}
		else
		{
			Ray.stepDirection.y = 1;
			Ray.travelDist.y = (1.0 - Player.cellPosition.y) * Ray.unitStepSize.y;
		}
	
		/*		
			Lastly, we call checkForCollision(). This performs the DDA operation for each ray, adjusting the hitDist during the proccess.
			Using this hitDist, we can multiply its value by the Ray.angleFromPlayer which we stored previously in the FOV setup. 

			Since we are using the hitDist in the checkForCollision function, we need to ensure we reset the value to zero if not hit.

			This will remove the fisheye effect seen in a ton of raycasters.
		*/
		checkForCollision(Ray);

		if(!Ray.hit)
			Ray.hitDist = 0;
		else if(Ray.hit && Ray.hitDist > maxDist)
		{
			Ray.hitDist = 0;
			Ray.hit = false;
		}

		//Remove fisheye effect
		Ray.renderDist = Ray.hitDist * Math.cos(Ray.angleFromPlayer);
	}
}

function updatePlayerProps()
{
	Player.currentCell.x = parseInt( Player.position.x / cellSize );
	Player.currentCell.y = parseInt( Player.position.y / cellSize );

	Player.cellPosition.x = ( Player.position.x - (cellSize * Player.currentCell.x) ) / cellSize;
	Player.cellPosition.y = ( Player.position.y - (cellSize * Player.currentCell.y) ) / cellSize;
}

function callInputController() {
	Object.keys(inputController).forEach(key => {
		if(inputController[key].pressed)
			inputController[key].fn();
	});
}

/*
	checkForCollision will be called once per frame as long as the init Length.x and .y values are not NaN.

	This entire proccess relies on comparing the two lengths for each unit of movement along a given axis (using Ray.unitStepSize.(x OR y)).
	We will increment one unit of movement until we find a collision or reach the max distance for detection
*/

function checkForCollision(Ray) 
{
	Ray.hit = false;

	while(!Ray.hit && Ray.hitDist < maxDist)
	{
		if(Ray.travelDist.x < Ray.travelDist.y)
		{
			Ray.hitDist = Ray.travelDist.x;
			Ray.travelDist.x += Ray.unitStepSize.x;
			Ray.cellToCheck.x += Ray.stepDirection.x;
			Ray.sideHit = 0;
		}
		else
		{
			Ray.hitDist = Ray.travelDist.y;
			Ray.travelDist.y += Ray.unitStepSize.y;
			Ray.cellToCheck.y += Ray.stepDirection.y;
			Ray.sideHit = 1;
		}
	
		if(worldMap[Ray.cellToCheck.y * mapWidth + Ray.cellToCheck.x] == 1)
			Ray.hit = true;
	}
}

function updateMousePosition(e) {
	let canvasRect = canvas.getBoundingClientRect();

	let tmpMouseCell = {
		x: parseInt((e.clientX - canvasRect.left) / cellSize),
		y: parseInt((e.clientY - canvasRect.top) / cellSize),
	};

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
	ctx.arc(Player.position.x, Player.position.y, 10, 0, 2 * Math.PI);
	ctx.fill();
}

function drawRay() {
	ctx.strokeStyle = '#54ff00';
	for(r in Player.rays)
	{
		let Ray = Player.rays[r];
	
		let x = Player.position.x;
		let y = Player.position.y;

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
		
		ctx.beginPath();
		ctx.moveTo(Player.position.x, Player.position.y);
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
			let colX = Player.position.x + (Ray.direction.x * Ray.hitDist);
			let colY = Player.position.y + (Ray.direction.y * Ray.hitDist);
		
			ctx.fillStyle = '#FE2836';
			ctx.beginPath();
			ctx.arc(colX, colY, 3, 0, 2 * Math.PI);
			ctx.fill();
		}
	}
}

function Init() {
	canvas.width = cellSize * mapWidth;
	canvas.height = cellSize * mapHeight;

	renderCanvas.width = viewWidth;
	renderCanvas.height = viewHeight;

	worldMap = generateMap();

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
		(inputController[e.type])
			inputController[e.type].pressed = true;
	});

	window.addEventListener('mouseup', (e) => {
		(inputController['mousedown'])
			inputController['mousedown'].pressed = false;
	});

	document.getElementById('reset').addEventListener('click', () => {
		worldMap = generateMap();
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
}

window.addEventListener('load', () => {
	Init();
	setInterval(() => {
		Update();
		Render();
	}, 1000 / fps);
});