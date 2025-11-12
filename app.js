// Modern Microwind Application
// A modern circuit design tool with snap grid, keyboard shortcuts, and improved UX

class ModernMicrowind {
    constructor() {
        // Canvas and context
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Settings
        this.gridSize = 10;
        this.gridVisible = true;
        this.snapEnabled = true;
        this.darkMode = false;
        this.zoom = 1;
        this.panOffset = { x: 0, y: 0 };
        
        // State
        this.currentTool = 'select';
        this.isDrawing = false;
        this.isPanning = false;
        this.startPoint = null;
        this.shapes = [];
        this.selectedShape = null;
        this.undoStack = [];
        this.redoStack = [];
        
        // Initialize
        this.setupCanvas();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.render();
        this.updateStatus();
    }

    setupCanvas() {
        // Set canvas size to match container
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        
        // Enable high DPI support
        const dpr = window.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.render();
        });

        // Canvas mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));

        // Tool buttons
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const tool = e.currentTarget.id.replace('Tool', '').replace('Toggle', '').replace('Btn', '');
                this.handleToolClick(tool, e.currentTarget);
            });
        });

        // Dark mode toggle
        document.getElementById('darkModeToggle').addEventListener('click', () => {
            this.toggleDarkMode();
        });

        // Grid size select
        document.getElementById('gridSize').addEventListener('change', (e) => {
            this.gridSize = parseInt(e.target.value);
            this.render();
            this.updateStatus();
        });

        // Property panel inputs
        document.getElementById('gridVisibleCheck').addEventListener('change', (e) => {
            this.gridVisible = e.target.checked;
            document.getElementById('gridToggle').classList.toggle('active', this.gridVisible);
            this.render();
        });

        document.getElementById('snapEnabledCheck').addEventListener('change', (e) => {
            this.snapEnabled = e.target.checked;
            document.getElementById('snapToggle').classList.toggle('active', this.snapEnabled);
            this.updateStatus();
        });

        document.getElementById('gridSizeInput').addEventListener('change', (e) => {
            this.gridSize = parseInt(e.target.value);
            document.getElementById('gridSize').value = e.target.value;
            this.render();
            this.updateStatus();
        });

        // Zoom buttons
        document.getElementById('zoomIn').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoomOut').addEventListener('click', () => this.zoomOut());
        document.getElementById('zoomFit').addEventListener('click', () => this.zoomFit());
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Prevent default for shortcuts
            const shortcuts = {
                'F7': () => { e.preventDefault(); this.toggleGrid(); },
                'F9': () => { e.preventDefault(); this.toggleSnap(); },
                'KeyV': () => !e.ctrlKey && this.setTool('select'),
                'KeyR': () => !e.ctrlKey && this.setTool('rect'),
                'KeyW': () => !e.ctrlKey && this.setTool('wire'),
                'KeyC': () => !e.ctrlKey && e.code === 'KeyC' && this.setTool('component'),
                'KeyF': () => !e.ctrlKey && this.zoomFit(),
                'Delete': () => this.deleteSelected(),
                'Space': () => { e.preventDefault(); this.isPanning = true; }
            };

            // Handle modifier key combinations
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' || e.key === 'Z') {
                    e.preventDefault();
                    this.undo();
                } else if (e.key === 'y' || e.key === 'Y') {
                    e.preventDefault();
                    this.redo();
                } else if (e.key === 'c' || e.key === 'C') {
                    e.preventDefault();
                    this.copy();
                } else if (e.key === 'v' || e.key === 'V') {
                    e.preventDefault();
                    this.paste();
                } else if (e.key === 'a' || e.key === 'A') {
                    e.preventDefault();
                    this.selectAll();
                } else if (e.key === 'd' || e.key === 'D') {
                    e.preventDefault();
                    this.toggleDarkMode();
                } else if (e.key === '=' || e.key === '+') {
                    e.preventDefault();
                    this.zoomIn();
                } else if (e.key === '-') {
                    e.preventDefault();
                    this.zoomOut();
                }
            } else {
                const handler = shortcuts[e.code];
                if (handler) handler();
            }

            // Arrow key navigation
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault();
                this.handleArrowKey(e.key);
            }
        });

        document.addEventListener('keyup', (e) => {
            if (e.code === 'Space') {
                this.isPanning = false;
            }
        });
    }

    handleMouseDown(e) {
        const pos = this.getMousePos(e);
        const snappedPos = this.snapEnabled ? this.snapToGrid(pos) : pos;
        
        if (this.isPanning || e.button === 1) { // Middle mouse or space+click
            this.isPanning = true;
            this.startPoint = pos;
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        this.isDrawing = true;
        this.startPoint = snappedPos;

        if (this.currentTool === 'select') {
            this.selectShapeAt(snappedPos);
        }
    }

    handleMouseMove(e) {
        const pos = this.getMousePos(e);
        const snappedPos = this.snapEnabled ? this.snapToGrid(pos) : pos;
        
        // Update cursor coordinates display
        this.updateCursorCoords(snappedPos);

        if (this.isPanning && this.startPoint) {
            const dx = pos.x - this.startPoint.x;
            const dy = pos.y - this.startPoint.y;
            this.panOffset.x += dx;
            this.panOffset.y += dy;
            this.startPoint = pos;
            this.render();
            return;
        }

        if (this.isDrawing && this.startPoint) {
            this.render();
            this.drawPreview(this.startPoint, snappedPos);
        }
    }

    handleMouseUp(e) {
        if (this.isPanning) {
            this.isPanning = false;
            this.canvas.style.cursor = 'crosshair';
            this.startPoint = null;
            return;
        }

        if (!this.isDrawing || !this.startPoint) return;

        const pos = this.getMousePos(e);
        const snappedPos = this.snapEnabled ? this.snapToGrid(pos) : pos;
        
        if (this.currentTool === 'rect') {
            this.addShape({
                type: 'rectangle',
                x: Math.min(this.startPoint.x, snappedPos.x),
                y: Math.min(this.startPoint.y, snappedPos.y),
                width: Math.abs(snappedPos.x - this.startPoint.x),
                height: Math.abs(snappedPos.y - this.startPoint.y),
                color: '#2196F3'
            });
        } else if (this.currentTool === 'wire') {
            this.addShape({
                type: 'wire',
                x1: this.startPoint.x,
                y1: this.startPoint.y,
                x2: snappedPos.x,
                y2: snappedPos.y,
                color: '#4CAF50'
            });
        } else if (this.currentTool === 'component') {
            this.addShape({
                type: 'component',
                x: snappedPos.x - 20,
                y: snappedPos.y - 20,
                width: 40,
                height: 40,
                color: '#FF9800'
            });
        }

        this.isDrawing = false;
        this.startPoint = null;
        this.render();
    }

    handleWheel(e) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        this.zoom *= delta;
        this.zoom = Math.max(0.1, Math.min(5, this.zoom));
        this.render();
        this.updateStatus();
    }

    handleArrowKey(key) {
        const step = this.gridSize;
        switch(key) {
            case 'ArrowUp':
                this.panOffset.y += step;
                break;
            case 'ArrowDown':
                this.panOffset.y -= step;
                break;
            case 'ArrowLeft':
                this.panOffset.x += step;
                break;
            case 'ArrowRight':
                this.panOffset.x -= step;
                break;
        }
        this.render();
    }

    getMousePos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left - this.panOffset.x) / this.zoom,
            y: (e.clientY - rect.top - this.panOffset.y) / this.zoom
        };
    }

    snapToGrid(pos) {
        return {
            x: Math.round(pos.x / this.gridSize) * this.gridSize,
            y: Math.round(pos.y / this.gridSize) * this.gridSize
        };
    }

    handleToolClick(tool, button) {
        if (tool === 'grid') {
            this.toggleGrid();
        } else if (tool === 'snap') {
            this.toggleSnap();
        } else if (tool === 'undo') {
            this.undo();
        } else if (tool === 'redo') {
            this.redo();
        } else {
            this.setTool(tool);
        }
    }

    setTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => {
            if (btn.id === tool + 'Tool') {
                btn.classList.add('active');
            } else if (!btn.id.includes('Toggle') && !btn.id.includes('Btn')) {
                btn.classList.remove('active');
            }
        });
        this.updateStatus(`Tool: ${tool.charAt(0).toUpperCase() + tool.slice(1)}`);
    }

    toggleGrid() {
        this.gridVisible = !this.gridVisible;
        document.getElementById('gridToggle').classList.toggle('active', this.gridVisible);
        document.getElementById('gridVisibleCheck').checked = this.gridVisible;
        this.render();
        this.updateStatus();
    }

    toggleSnap() {
        this.snapEnabled = !this.snapEnabled;
        document.getElementById('snapToggle').classList.toggle('active', this.snapEnabled);
        document.getElementById('snapEnabledCheck').checked = this.snapEnabled;
        this.updateStatus();
    }

    toggleDarkMode() {
        this.darkMode = !this.darkMode;
        document.body.classList.toggle('dark-mode', this.darkMode);
        this.render();
        const icon = document.querySelector('#darkModeToggle .icon');
        icon.textContent = this.darkMode ? '☀️' : '🌙';
    }

    addShape(shape) {
        this.undoStack.push([...this.shapes]);
        this.redoStack = [];
        this.shapes.push(shape);
        this.updateStatus(`Added ${shape.type}`);
    }

    selectShapeAt(pos) {
        this.selectedShape = null;
        for (let i = this.shapes.length - 1; i >= 0; i--) {
            const shape = this.shapes[i];
            if (this.isPointInShape(pos, shape)) {
                this.selectedShape = shape;
                break;
            }
        }
        this.updateSelectionInfo();
        this.render();
    }

    isPointInShape(pos, shape) {
        if (shape.type === 'rectangle' || shape.type === 'component') {
            return pos.x >= shape.x && pos.x <= shape.x + shape.width &&
                   pos.y >= shape.y && pos.y <= shape.y + shape.height;
        } else if (shape.type === 'wire') {
            // Check if point is near line
            const dist = this.pointToLineDistance(pos, 
                {x: shape.x1, y: shape.y1}, 
                {x: shape.x2, y: shape.y2});
            return dist < 5;
        }
        return false;
    }

    pointToLineDistance(point, lineStart, lineEnd) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;
        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;
        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }

        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    deleteSelected() {
        if (this.selectedShape) {
            this.undoStack.push([...this.shapes]);
            this.redoStack = [];
            this.shapes = this.shapes.filter(s => s !== this.selectedShape);
            this.selectedShape = null;
            this.updateSelectionInfo();
            this.render();
            this.updateStatus('Deleted shape');
        }
    }

    undo() {
        if (this.undoStack.length > 0) {
            this.redoStack.push([...this.shapes]);
            this.shapes = this.undoStack.pop();
            this.render();
            this.updateStatus('Undo');
        }
    }

    redo() {
        if (this.redoStack.length > 0) {
            this.undoStack.push([...this.shapes]);
            this.shapes = this.redoStack.pop();
            this.render();
            this.updateStatus('Redo');
        }
    }

    copy() {
        if (this.selectedShape) {
            this.clipboard = JSON.parse(JSON.stringify(this.selectedShape));
            this.updateStatus('Copied');
        }
    }

    paste() {
        if (this.clipboard) {
            const newShape = JSON.parse(JSON.stringify(this.clipboard));
            newShape.x += 20;
            newShape.y += 20;
            if (newShape.x1) {
                newShape.x1 += 20;
                newShape.y1 += 20;
                newShape.x2 += 20;
                newShape.y2 += 20;
            }
            this.addShape(newShape);
            this.render();
        }
    }

    selectAll() {
        // Select all would be implemented with multi-selection
        this.updateStatus('Select all not yet implemented');
    }

    zoomIn() {
        this.zoom = Math.min(5, this.zoom * 1.2);
        this.render();
        this.updateStatus();
    }

    zoomOut() {
        this.zoom = Math.max(0.1, this.zoom / 1.2);
        this.render();
        this.updateStatus();
    }

    zoomFit() {
        this.zoom = 1;
        this.panOffset = { x: 0, y: 0 };
        this.render();
        this.updateStatus();
    }

    render() {
        const ctx = this.ctx;
        const rect = this.canvas.getBoundingClientRect();
        
        // Clear canvas
        ctx.clearRect(0, 0, rect.width, rect.height);
        
        // Save context state
        ctx.save();
        
        // Apply transformations
        ctx.translate(this.panOffset.x, this.panOffset.y);
        ctx.scale(this.zoom, this.zoom);
        
        // Draw grid
        if (this.gridVisible) {
            this.drawGrid(ctx, rect);
        }
        
        // Draw shapes
        this.shapes.forEach(shape => {
            this.drawShape(ctx, shape, shape === this.selectedShape);
        });
        
        // Restore context state
        ctx.restore();
    }

    drawGrid(ctx, rect) {
        const gridColor = this.darkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)';
        ctx.strokeStyle = gridColor;
        ctx.lineWidth = 1;

        const startX = Math.floor(-this.panOffset.x / this.zoom / this.gridSize) * this.gridSize;
        const startY = Math.floor(-this.panOffset.y / this.zoom / this.gridSize) * this.gridSize;
        const endX = startX + rect.width / this.zoom + this.gridSize;
        const endY = startY + rect.height / this.zoom + this.gridSize;

        // Vertical lines
        for (let x = startX; x <= endX; x += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = startY; y <= endY; y += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
        }
    }

    drawShape(ctx, shape, isSelected) {
        ctx.strokeStyle = isSelected ? '#FF5722' : shape.color;
        ctx.fillStyle = shape.color + '40'; // Add transparency
        ctx.lineWidth = isSelected ? 3 : 2;

        if (shape.type === 'rectangle' || shape.type === 'component') {
            ctx.fillRect(shape.x, shape.y, shape.width, shape.height);
            ctx.strokeRect(shape.x, shape.y, shape.width, shape.height);
            
            if (shape.type === 'component') {
                // Draw component symbol
                ctx.strokeStyle = shape.color;
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(shape.x + 10, shape.y + shape.height / 2);
                ctx.lineTo(shape.x + shape.width - 10, shape.y + shape.height / 2);
                ctx.stroke();
            }
        } else if (shape.type === 'wire') {
            ctx.beginPath();
            ctx.moveTo(shape.x1, shape.y1);
            ctx.lineTo(shape.x2, shape.y2);
            ctx.stroke();
            
            // Draw endpoints
            ctx.fillStyle = shape.color;
            ctx.beginPath();
            ctx.arc(shape.x1, shape.y1, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(shape.x2, shape.y2, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    drawPreview(start, end) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(this.panOffset.x, this.panOffset.y);
        ctx.scale(this.zoom, this.zoom);

        ctx.strokeStyle = '#2196F3';
        ctx.fillStyle = 'rgba(33, 150, 243, 0.2)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        if (this.currentTool === 'rect') {
            const x = Math.min(start.x, end.x);
            const y = Math.min(start.y, end.y);
            const w = Math.abs(end.x - start.x);
            const h = Math.abs(end.y - start.y);
            ctx.fillRect(x, y, w, h);
            ctx.strokeRect(x, y, w, h);
        } else if (this.currentTool === 'wire') {
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
        }

        ctx.restore();
    }

    updateCursorCoords(pos) {
        const coordsEl = document.getElementById('cursorCoords');
        coordsEl.textContent = `X: ${pos.x.toFixed(1)}, Y: ${pos.y.toFixed(1)}`;
    }

    updateSelectionInfo() {
        const infoEl = document.getElementById('selectionInfo');
        if (this.selectedShape) {
            infoEl.textContent = `Selected: ${this.selectedShape.type}`;
        } else {
            infoEl.textContent = 'No selection';
        }
    }

    updateStatus(message = null) {
        if (message) {
            document.getElementById('statusMessage').textContent = message;
        }
        document.getElementById('zoomLevel').textContent = `Zoom: ${(this.zoom * 100).toFixed(0)}%`;
        document.getElementById('gridInfo').textContent = 
            `Grid: ${this.gridSize}px, Snap: ${this.snapEnabled ? 'On' : 'Off'}`;
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new ModernMicrowind();
});
