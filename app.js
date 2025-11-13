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
        
        // Layer Management - Standard CMOS/VLSI Layers
        this.layers = [
            { id: 'metal2', name: 'Metal 2', color: '#0080FF', visible: true, active: false, type: 'Interconnect' },
            { id: 'metal1', name: 'Metal 1', color: '#4FC3F7', visible: true, active: false, type: 'Interconnect' },
            { id: 'poly', name: 'Polysilicon', color: '#FF5722', visible: true, active: false, type: 'Gate' },
            { id: 'ndiff', name: 'N-Diffusion', color: '#4CAF50', visible: true, active: false, type: 'Active' },
            { id: 'pdiff', name: 'P-Diffusion', color: '#FFC107', visible: true, active: false, type: 'Active' },
            { id: 'contact', name: 'Contact', color: '#9E9E9E', visible: true, active: false, type: 'Via' }
        ];
        this.activeLayer = 'metal1';
        
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
        this.setupLayers();
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

    setupLayers() {
        // Build layer list UI
        const layerList = document.getElementById('layerList');
        layerList.innerHTML = '';
        
        this.layers.forEach((layer, index) => {
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            layerItem.dataset.layerId = layer.id;
            
            if (layer.id === this.activeLayer) {
                layerItem.classList.add('active');
                layer.active = true;
            }
            
            layerItem.innerHTML = `
                <input type="checkbox" class="layer-checkbox" ${layer.visible ? 'checked' : ''} data-layer="${layer.id}">
                <div class="layer-color" style="background-color: ${layer.color}"></div>
                <span class="layer-name">${layer.name}</span>
                <span class="layer-type">${layer.type}</span>
            `;
            
            // Click to set active layer
            layerItem.addEventListener('click', (e) => {
                if (!e.target.classList.contains('layer-checkbox')) {
                    this.setActiveLayer(layer.id);
                }
            });
            
            // Checkbox to toggle visibility
            const checkbox = layerItem.querySelector('.layer-checkbox');
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleLayerVisibility(layer.id);
            });
            
            layerList.appendChild(layerItem);
        });
    }

    setActiveLayer(layerId) {
        // Update active layer
        this.activeLayer = layerId;
        
        // Update layer list UI
        document.querySelectorAll('.layer-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.layerId === layerId) {
                item.classList.add('active');
            }
        });
        
        // Update layers array
        this.layers.forEach(layer => {
            layer.active = (layer.id === layerId);
        });
        
        this.updateStatus(`Active layer: ${this.getLayerById(layerId).name}`);
    }

    toggleLayerVisibility(layerId) {
        const layer = this.getLayerById(layerId);
        if (layer) {
            layer.visible = !layer.visible;
            this.render();
        }
    }

    getLayerById(layerId) {
        return this.layers.find(l => l.id === layerId);
    }

    getActiveLayerColor() {
        const layer = this.getLayerById(this.activeLayer);
        return layer ? layer.color : '#2196F3';
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
            this.updateLambdaDisplay();
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
            this.updateLambdaDisplay();
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
            // Layer switching with number keys (1-6)
            if (!e.ctrlKey && !e.metaKey && e.key >= '1' && e.key <= '6') {
                const layerIndex = parseInt(e.key) - 1;
                if (layerIndex < this.layers.length) {
                    this.setActiveLayer(this.layers[layerIndex].id);
                }
                return;
            }
            
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
                color: this.getActiveLayerColor(),
                layer: this.activeLayer
            });
        } else if (this.currentTool === 'wire') {
            this.addShape({
                type: 'wire',
                x1: this.startPoint.x,
                y1: this.startPoint.y,
                x2: snappedPos.x,
                y2: snappedPos.y,
                color: this.getActiveLayerColor(),
                layer: this.activeLayer
            });
        } else if (this.currentTool === 'component') {
            this.addShape({
                type: 'component',
                x: snappedPos.x - 20,
                y: snappedPos.y - 20,
                width: 40,
                height: 40,
                color: this.getActiveLayerColor(),
                layer: this.activeLayer
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
        
        // Draw shapes (only visible layers)
        this.shapes.forEach(shape => {
            // Check if shape's layer is visible
            const layer = this.getLayerById(shape.layer);
            if (!layer || layer.visible) {
                this.drawShape(ctx, shape, shape === this.selectedShape);
            }
        });
        
        // Restore context state
        ctx.restore();
    }

    drawGrid(ctx, rect) {
        const minorGridColor = this.darkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.08)';
        const majorGridColor = this.darkMode ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.15)';
        
        const startX = Math.floor(-this.panOffset.x / this.zoom / this.gridSize) * this.gridSize;
        const startY = Math.floor(-this.panOffset.y / this.zoom / this.gridSize) * this.gridSize;
        const endX = startX + rect.width / this.zoom + this.gridSize;
        const endY = startY + rect.height / this.zoom + this.gridSize;

        // Draw minor grid lines (every gridSize)
        ctx.strokeStyle = minorGridColor;
        ctx.lineWidth = 0.5;
        
        for (let x = startX; x <= endX; x += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            ctx.stroke();
        }
        
        for (let y = startY; y <= endY; y += this.gridSize) {
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
        }
        
        // Draw major grid lines (every 5x gridSize)
        ctx.strokeStyle = majorGridColor;
        ctx.lineWidth = 1;
        const majorGridSize = this.gridSize * 5;
        
        const majorStartX = Math.floor(startX / majorGridSize) * majorGridSize;
        const majorStartY = Math.floor(startY / majorGridSize) * majorGridSize;
        
        for (let x = majorStartX; x <= endX; x += majorGridSize) {
            ctx.beginPath();
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
            ctx.stroke();
        }
        
        for (let y = majorStartY; y <= endY; y += majorGridSize) {
            ctx.beginPath();
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
            ctx.stroke();
        }
        
        // Draw origin indicator (0,0) with crosshairs
        if (startX <= 0 && endX >= 0 && startY <= 0 && endY >= 0) {
            ctx.strokeStyle = this.darkMode ? 'rgba(76, 175, 80, 0.5)' : 'rgba(76, 175, 80, 0.7)';
            ctx.lineWidth = 2;
            const originSize = 15;
            
            // Vertical line
            ctx.beginPath();
            ctx.moveTo(0, -originSize);
            ctx.lineTo(0, originSize);
            ctx.stroke();
            
            // Horizontal line
            ctx.beginPath();
            ctx.moveTo(-originSize, 0);
            ctx.lineTo(originSize, 0);
            ctx.stroke();
        }
    }

    drawShape(ctx, shape, isSelected) {
        // Enable anti-aliasing for smoother edges
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        const layer = this.getLayerById(shape.layer);
        const layerType = layer ? layer.type : 'default';

        if (shape.type === 'rectangle' || shape.type === 'component') {
            // Enhanced rectangle rendering with gradients and shadows
            const x = shape.x;
            const y = shape.y;
            const w = shape.width;
            const h = shape.height;
            
            // Add shadow for depth (only when not selected)
            if (!isSelected) {
                ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 2;
                ctx.shadowOffsetY = 2;
            }
            
            // Create gradient fill based on layer type
            let gradient;
            if (layerType === 'Interconnect') {
                // Metallic gradient for metal layers
                gradient = ctx.createLinearGradient(x, y, x, y + h);
                gradient.addColorStop(0, shape.color + 'A0');
                gradient.addColorStop(0.5, shape.color + '60');
                gradient.addColorStop(1, shape.color + 'A0');
            } else if (layerType === 'Gate') {
                // Poly layer - subtle pattern
                gradient = ctx.createLinearGradient(x, y, x + w, y);
                gradient.addColorStop(0, shape.color + '80');
                gradient.addColorStop(0.5, shape.color + '50');
                gradient.addColorStop(1, shape.color + '80');
            } else if (layerType === 'Active') {
                // Diffusion layers - solid with texture
                gradient = ctx.createRadialGradient(x + w/2, y + h/2, 0, x + w/2, y + h/2, Math.max(w, h)/2);
                gradient.addColorStop(0, shape.color + '70');
                gradient.addColorStop(1, shape.color + '40');
            } else {
                // Default - simple gradient
                gradient = ctx.createLinearGradient(x, y, x + w, y + h);
                gradient.addColorStop(0, shape.color + '60');
                gradient.addColorStop(1, shape.color + '40');
            }
            
            ctx.fillStyle = gradient;
            
            // Draw with rounded corners for a more modern look
            const radius = Math.min(4, w / 10, h / 10);
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + w - radius, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
            ctx.lineTo(x + w, y + h - radius);
            ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
            ctx.lineTo(x + radius, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            ctx.fill();
            
            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Draw border
            ctx.strokeStyle = isSelected ? '#FF5722' : shape.color;
            ctx.lineWidth = isSelected ? 3 : 2;
            ctx.stroke();
            
            // Add inner highlight for selected shapes
            if (isSelected) {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x + radius + 1, y + 1);
                ctx.lineTo(x + w - radius - 1, y + 1);
                ctx.stroke();
            }
            
            // Add texture pattern for Via/Contact layers
            if (layerType === 'Via') {
                ctx.strokeStyle = shape.color;
                ctx.lineWidth = 1;
                ctx.globalAlpha = 0.3;
                const spacing = 8;
                for (let dx = 0; dx < w; dx += spacing) {
                    for (let dy = 0; dy < h; dy += spacing) {
                        ctx.fillStyle = shape.color;
                        ctx.fillRect(x + dx + 2, y + dy + 2, 2, 2);
                    }
                }
                ctx.globalAlpha = 1;
            }
            
            if (shape.type === 'component') {
                // Enhanced component symbol
                ctx.strokeStyle = shape.color;
                ctx.lineWidth = 2.5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(x + 10, y + h / 2);
                ctx.lineTo(x + w - 10, y + h / 2);
                ctx.stroke();
                
                // Add component markers
                ctx.fillStyle = shape.color;
                ctx.beginPath();
                ctx.arc(x + 10, y + h / 2, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x + w - 10, y + h / 2, 4, 0, Math.PI * 2);
                ctx.fill();
            }
        } else if (shape.type === 'wire') {
            // Enhanced wire rendering
            const layer = this.getLayerById(shape.layer);
            const isMetalLayer = layer && layer.type === 'Interconnect';
            
            // Draw shadow for wires
            if (!isSelected && isMetalLayer) {
                ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
                ctx.shadowBlur = 3;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;
            }
            
            ctx.strokeStyle = isSelected ? '#FF5722' : shape.color;
            ctx.lineWidth = isSelected ? 4 : 3;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            
            ctx.beginPath();
            ctx.moveTo(shape.x1, shape.y1);
            ctx.lineTo(shape.x2, shape.y2);
            ctx.stroke();
            
            // Reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;
            
            // Draw enhanced endpoints
            const endpointSize = isSelected ? 5 : 4;
            ctx.fillStyle = shape.color;
            ctx.strokeStyle = isSelected ? '#FF5722' : 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1.5;
            
            ctx.beginPath();
            ctx.arc(shape.x1, shape.y1, endpointSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            ctx.beginPath();
            ctx.arc(shape.x2, shape.y2, endpointSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            
            // Add glow effect for selected wires
            if (isSelected) {
                ctx.strokeStyle = 'rgba(255, 87, 34, 0.3)';
                ctx.lineWidth = 8;
                ctx.beginPath();
                ctx.moveTo(shape.x1, shape.y1);
                ctx.lineTo(shape.x2, shape.y2);
                ctx.stroke();
            }
        }
    }

    drawPreview(start, end) {
        const ctx = this.ctx;
        ctx.save();
        ctx.translate(this.panOffset.x, this.panOffset.y);
        ctx.scale(this.zoom, this.zoom);

        // Enhanced preview with active layer color
        const activeLayerColor = this.getActiveLayerColor();
        ctx.strokeStyle = activeLayerColor;
        ctx.fillStyle = activeLayerColor + '30';
        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.setLineDash([8, 4]);

        if (this.currentTool === 'rect' || this.currentTool === 'component') {
            const x = Math.min(start.x, end.x);
            const y = Math.min(start.y, end.y);
            const w = Math.abs(end.x - start.x);
            const h = Math.abs(end.y - start.y);
            
            // Add animated glow effect
            const time = Date.now() / 1000;
            const glowAlpha = (Math.sin(time * 3) + 1) / 2 * 0.3 + 0.2;
            ctx.shadowColor = activeLayerColor;
            ctx.shadowBlur = 10;
            
            // Draw with rounded corners
            const radius = Math.min(4, w / 10, h / 10);
            ctx.beginPath();
            ctx.moveTo(x + radius, y);
            ctx.lineTo(x + w - radius, y);
            ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
            ctx.lineTo(x + w, y + h - radius);
            ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
            ctx.lineTo(x + radius, y + h);
            ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
            ctx.lineTo(x, y + radius);
            ctx.quadraticCurveTo(x, y, x + radius, y);
            ctx.closePath();
            
            ctx.fill();
            ctx.globalAlpha = 0.8;
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.shadowBlur = 0;
            
            // Show dimensions during drawing
            ctx.setLineDash([]);
            ctx.font = '12px monospace';
            ctx.fillStyle = this.darkMode ? '#ffffff' : '#000000';
            ctx.strokeStyle = this.darkMode ? '#000000' : '#ffffff';
            ctx.lineWidth = 3;
            
            const dimText = `${Math.abs(w).toFixed(0)} × ${Math.abs(h).toFixed(0)}`;
            const textWidth = ctx.measureText(dimText).width;
            const textX = x + w / 2 - textWidth / 2;
            const textY = y - 5;
            
            if (textY > 15) {
                ctx.strokeText(dimText, textX, textY);
                ctx.fillText(dimText, textX, textY);
            }
        } else if (this.currentTool === 'wire') {
            // Enhanced wire preview
            const time = Date.now() / 1000;
            ctx.shadowColor = activeLayerColor;
            ctx.shadowBlur = 8;
            
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.moveTo(start.x, start.y);
            ctx.lineTo(end.x, end.y);
            ctx.stroke();
            
            ctx.shadowBlur = 0;
            
            // Draw endpoints with pulse effect
            const pulseSize = 4 + Math.sin(time * 4) * 1;
            ctx.setLineDash([]);
            ctx.fillStyle = activeLayerColor;
            ctx.beginPath();
            ctx.arc(start.x, start.y, pulseSize, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(end.x, end.y, pulseSize, 0, Math.PI * 2);
            ctx.fill();
            
            // Show length
            const dx = end.x - start.x;
            const dy = end.y - start.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            
            ctx.font = '12px monospace';
            ctx.fillStyle = this.darkMode ? '#ffffff' : '#000000';
            ctx.strokeStyle = this.darkMode ? '#000000' : '#ffffff';
            ctx.lineWidth = 3;
            
            const lenText = `${length.toFixed(0)}px`;
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2 - 8;
            const textWidth = ctx.measureText(lenText).width;
            
            ctx.strokeText(lenText, midX - textWidth / 2, midY);
            ctx.fillText(lenText, midX - textWidth / 2, midY);
        }

        ctx.restore();
    }

    updateCursorCoords(pos) {
        const coordsEl = document.getElementById('cursorCoords');
        coordsEl.textContent = `X: ${pos.x.toFixed(1)}, Y: ${pos.y.toFixed(1)}`;
    }

    updateSelectionInfo() {
        const infoEl = document.getElementById('selectionInfo');
        const measurementEl = document.getElementById('measurementInfo');
        
        if (this.selectedShape) {
            const layer = this.getLayerById(this.selectedShape.layer);
            const layerName = layer ? layer.name : 'Unknown';
            infoEl.textContent = `Selected: ${this.selectedShape.type} (${layerName})`;
            
            // Show measurements
            let measurements = '';
            if (this.selectedShape.type === 'rectangle' || this.selectedShape.type === 'component') {
                const widthLambda = (this.selectedShape.width / this.gridSize).toFixed(1);
                const heightLambda = (this.selectedShape.height / this.gridSize).toFixed(1);
                const area = this.selectedShape.width * this.selectedShape.height;
                measurements = `Width: ${this.selectedShape.width}px (${widthLambda}λ)\n`;
                measurements += `Height: ${this.selectedShape.height}px (${heightLambda}λ)\n`;
                measurements += `Area: ${area}px²`;
            } else if (this.selectedShape.type === 'wire') {
                const dx = this.selectedShape.x2 - this.selectedShape.x1;
                const dy = this.selectedShape.y2 - this.selectedShape.y1;
                const length = Math.sqrt(dx * dx + dy * dy);
                const lengthLambda = (length / this.gridSize).toFixed(1);
                measurements = `Length: ${length.toFixed(1)}px (${lengthLambda}λ)`;
            }
            measurementEl.textContent = measurements;
        } else {
            infoEl.textContent = 'No selection';
            measurementEl.textContent = '';
        }
    }

    updateLambdaDisplay() {
        const lambdaGridEl = document.getElementById('lambdaGrid');
        if (lambdaGridEl) {
            lambdaGridEl.textContent = `${this.gridSize}λ`;
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
