const canvas = document.getElementById('myCanvas');
const ctx = canvas.getContext('2d');

function resizeCanvas() {

    canvas.width = window.innerWidth - 5;
    canvas.height = window.innerHeight - 5;
    
}

// Initial canvas size setup
resizeCanvas();

// Add an event listener for window resize
window.addEventListener('resize', resizeCanvas);

const nodes = [];

blackHoleMode = false;

class Node {
    constructor() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.radius = 2;
        this.speedX = (Math.random() * 2 - 1) / 8;  
        this.speedY = (Math.random() * 2 - 1) / 8;
        this.mass = (Math.random() + 1 ) * 10;
        this.clickedInProximity = false;
        this.clickTime = 0; // Timestamp when clicked
        this.accelerationX = 0;
        this.accelerationY = 0;
        this.elapsedSeconds = 99999;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'white';
        ctx.fill();
        ctx.closePath();
    }

    update() {
        this.draw();

        // Attraction towards the mouse cursor
        const dx = mouseX - this.x;
        const dy = mouseY - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // maybe scale this quadratically or real gravity
       if(distance < 250 ) {
            if(!blackHoleMode){
                if (dx != 0) {
                    this.speedX += (dx / (distance * distance)) / 15;
                }
                if (dy != 0) {  
                    this.speedY += (dy / (distance * distance)) / 15;
                }
            } else {
                if (dx != 0) {
                    this.speedX += (dx / (distance * distance)) / 2;
                }
                if (dy != 0) {  
                    this.speedY += (dy / (distance * distance)) / 2;
                }
            }
       }

         // Decay speed over a few seconds
         if (this.clickedInProximity) {
            this.elapsedSeconds = (Date.now() - this.clickTime) / 1000;
            if (this.elapsedSeconds < 60) { // Adjust the decay time as needed
                this.x += this.accelerationX / (this.elapsedSeconds + 1);
                this.y += this.accelerationY / (this.elapsedSeconds + 1);
            } else {
                this.clickedInProximity = false;
                this.accelerationX = 0;
                this.accelerationY = 0;
                this.elapsedSeconds = 99999;
            }
        }
        
         // Attraction function node-to-node
         for (const otherNode of nodes) {
            if (otherNode !== this) {
                const dx = otherNode.x - this.x;
                const dy = otherNode.y - this.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if(distance < 100 ) {
                    if (abs(dx) > 1) {
                        this.speedX += ( ( dx * this.mass * otherNode.mass) / (distance * distance)) / 200;
                    }
                    if (abs(dy) > 1) {  
                        this.speedY += ( ( dy * this.mass * otherNode.mass) / (distance * distance)) / 200;
                    }
               }
            }
        }
        

        this.x += this.speedX;
        this.y += this.speedY;

        // Bounce off the walls
        if (this.x - this.radius < 0 || this.x + this.radius > canvas.width) {
            this.speedX = -1 * this.speedX;  
        }

        if (this.y - this.radius < 0 || this.y + this.radius > canvas.height) {
            this.speedY = -1 * this.speedY;
        }
    }
}

let mouseX, mouseY;

canvas.addEventListener('mousemove', handleMove);
canvas.addEventListener('touchmove', handleMove);

function handleMove(event) {
    const moveX = event.clientX || event.touches[0].clientX;
    const moveY = event.clientY || event.touches[0].clientY;

    // Update the global mouseX and mouseY variables
    mouseX = moveX;
    mouseY = moveY;
}

document.addEventListener('click', handleTap);
document.addEventListener('touchstart', handleTap);

function handleTap(event) {
    // Push nodes significantly away from the cursor on click or screen tap
    const tapX = event.clientX || event.touches[0].clientX;
    const tapY = event.clientY || event.touches[0].clientY;

    for (const node of nodes) {
        const dx = tapX - node.x;
        const dy = tapY - node.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 50) { // Adjust the distance as needed
            node.clickedInProximity = true;
            node.clickTime = Date.now();
            node.accelerationX += 1.2 / -(dx + 1); // Increase speed
            node.accelerationY += 1.2 / -(dy + 1);
        }
    }
};

// function triggered by the "n" key
function createNodes(numNodes = 1) {
    for (let i = 0; i < numNodes; i++) {
        nodes.push(new Node());
    }
}

const keysPressed = {};

// Add an event listener for the "keydown" event
document.addEventListener('keydown', (event) => {
    keysPressed[event.key] = true;
    if (keysPressed['n'] ) {
        createNodes(1);
    }
    if (keysPressed['n'] && keysPressed['0']) {
        createNodes(10);
    }
    if (keysPressed['b']) {
        blackHoleMode = !blackHoleMode;
    }
});

// Add an event listener for the "keyup" event to release the keys
document.addEventListener('keyup', (event) => {
    keysPressed[event.key] = false;
});

// Create nodes with constant initial direction
for (let i = 0; i < 120; i++) {
    nodes.push(new Node());
}

function drawLines() {
    //ctx.strokeStyle = 'rgba(150, 150, 150, 0.2)'; // Faint grey color
    ctx.lineWidth = 3;

    for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[i].x - nodes[j].x;
            const dy = nodes[i].y - nodes[j].y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 100) {
                const opacity = 1 - distance / 90; // Fade in from black to grey

                ctx.beginPath();
                ctx.moveTo(nodes[i].x, nodes[i].y);
                ctx.lineTo(nodes[j].x, nodes[j].y);
                ctx.strokeStyle = `rgba(150, 150, 150, ${opacity})`; // Black with variable opacity
                ctx.lineWidth = 1;
                ctx.stroke();
                ctx.closePath();
            }
        }
    }
}

function animate() {
    requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (const node of nodes) {
        node.update();
    }

    drawLines();
}

animate();

// Add an event listener to the 'About' link
document.querySelector('nav a[href="#about"]').addEventListener('click', function (event) {
    event.preventDefault();

    // Show the about content
    const aboutContent = document.getElementById('about-content');
    aboutContent.style.display = 'block';

    // Trigger a reflow to enable the transition
    void aboutContent.offsetWidth;

    // Fade in the about content
    aboutContent.style.opacity = '0.9';
});
/*
// Add an event listener to hide the about content when clicking outside
document.addEventListener('click', function (event) {
    const aboutContent = document.getElementById('about-content');

    if (event.target !== aboutContent && !aboutContent.contains(event.target)) {
        aboutContent.style.display = 'none';
        aboutContent.style.opacity = '0';
    }
});
*/

/* text sections */
let currentSection = '';

function navigateTo(section) {
    // If the clicked section is already active, hide it and return
    if (currentSection === section) {
        document.getElementById(section + '-section').classList.remove('show');
        currentSection = ''; // Reset current section
        document.getElementById('text-content').classList.remove('show');
        return;
    }

    // Hide the current active section if any
    if (currentSection !== '') {
        document.getElementById(currentSection + '-section').classList.remove('show');
        document.getElementById('text-content').classList.remove('show');
    }

    // Display the clicked section
    document.getElementById(section + '-section').classList.add('show');
    if(section !== '' && currentSection != section)
    {
        document.getElementById('text-content').classList.add('show');
    }
    currentSection = section; // Update current section
}


/* Hide some divs on keypress */
let isTextVisible = true; // Variable to track the visibility state

document.addEventListener('keypress', function(event) {
    if (event.key === 'h') {
        isTextVisible = !isTextVisible;

        var textOverlay = document.getElementById('text-overlay');
        var textContent = document.getElementById('text-content');

        textOverlay.style.visibility = isTextVisible ? 'visible' : 'hidden';
        textContent.style.visibility = isTextVisible ? 'visible' : 'hidden';
    }
});

/*
let currentSection = ''; // Variable to keep track of the current section

function navigateTo(section) {

    if (currentSection === section) {
        document.getElementById(section + '-section').style.display = 'none';
        currentSection = ''; // Reset current section
        return;
    }
      // Hide the current active section if any
      if (currentSection !== '') {
        document.getElementById(currentSection + '-section').style.display = 'none';
    }

    // Display the clicked section
    document.getElementById(section + '-section').style.display = 'block';
    currentSection = section; // Update current section
}
*/
/*
    switch (section) {
        case 'home':
            // Navigate to home section or perform related action
            break;
        case 'about':
            // Display the about section text
            document.getElementById('about-section').style.display = 'block';
            break;
        case 'projects':
            // Navigate to projects section or perform related action
            document.getElementById('projects-section').style.display = 'block';
            break;
        case 'photography':
            // Navigate to photography section or perform related action
            document.getElementById('photography-section').style.display = 'block';
            break;
        default:
            break;
    }
}
*/