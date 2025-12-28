class CurveEditor {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.width = 256;
    this.height = 256;
    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.points = [[0, 0], [255, 255]];
    this.selectedPoint = null;
    this.isDragging = false;
    this.onChange = null;

    this.setupEventListeners();
    this.render();
  }

  setupEventListeners() {
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
  }

  getMousePos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * (this.width / rect.width));
    const y = Math.round((e.clientY - rect.top) * (this.height / rect.height));
    return { x, y: this.height - y };
  }

  findNearestPoint(x, y, threshold = 10) {
    let nearest = null;
    let minDist = threshold;

    this.points.forEach((point, index) => {
      const dist = Math.sqrt(Math.pow(point[0] - x, 2) + Math.pow(point[1] - y, 2));
      if (dist < minDist) {
        minDist = dist;
        nearest = index;
      }
    });

    return nearest;
  }

  handleMouseDown(e) {
    const pos = this.getMousePos(e);
    const pointIndex = this.findNearestPoint(pos.x, pos.y);

    if (pointIndex !== null) {
      this.selectedPoint = pointIndex;
      this.isDragging = true;
    }
  }

  handleMouseMove(e) {
    if (this.isDragging && this.selectedPoint !== null) {
      const pos = this.getMousePos(e);

      if (this.selectedPoint === 0) {
        this.points[0] = [0, Math.max(0, Math.min(255, pos.y))];
      } else if (this.selectedPoint === this.points.length - 1) {
        this.points[this.selectedPoint] = [255, Math.max(0, Math.min(255, pos.y))];
      } else {
        const prevX = this.points[this.selectedPoint - 1][0];
        const nextX = this.points[this.selectedPoint + 1][0];
        const clampedX = Math.max(prevX + 1, Math.min(nextX - 1, pos.x));
        const clampedY = Math.max(0, Math.min(255, pos.y));
        this.points[this.selectedPoint] = [clampedX, clampedY];
      }

      this.render();
      if (this.onChange) {
        this.onChange(this.getPoints());
      }
    }
  }

  handleMouseUp(e) {
    this.isDragging = false;
  }

  handleDoubleClick(e) {
    const pos = this.getMousePos(e);
    const pointIndex = this.findNearestPoint(pos.x, pos.y);

    if (pointIndex !== null && pointIndex !== 0 && pointIndex !== this.points.length - 1) {
      this.points.splice(pointIndex, 1);
      this.render();
      if (this.onChange) {
        this.onChange(this.getPoints());
      }
    } else if (pointIndex === null) {
      const newPoint = [pos.x, pos.y];
      let insertIndex = this.points.length;
      for (let i = 0; i < this.points.length - 1; i++) {
        if (pos.x > this.points[i][0] && pos.x < this.points[i + 1][0]) {
          insertIndex = i + 1;
          break;
        }
      }
      this.points.splice(insertIndex, 0, newPoint);
      this.points.sort((a, b) => a[0] - b[0]);
      this.render();
      if (this.onChange) {
        this.onChange(this.getPoints());
      }
    }
  }

  buildCurveLUT() {
    const lut = new Array(256);
    const sortedPoints = [...this.points].sort((a, b) => a[0] - b[0]);

    for (let i = 0; i < 256; i++) {
      let beforeIdx = 0;
      let afterIdx = sortedPoints.length - 1;

      for (let j = 0; j < sortedPoints.length - 1; j++) {
        if (i >= sortedPoints[j][0] && i <= sortedPoints[j + 1][0]) {
          beforeIdx = j;
          afterIdx = j + 1;
          break;
        }
      }

      const [x0, y0] = sortedPoints[beforeIdx];
      const [x1, y1] = sortedPoints[afterIdx];

      if (x1 === x0) {
        lut[i] = y0;
      } else {
        const t = (i - x0) / (x1 - x0);
        lut[i] = y0 + t * (y1 - y0);
      }
    }

    return lut;
  }

  render() {
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(0, 0, this.width, this.height);

    this.ctx.strokeStyle = '#333';
    this.ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = (this.width / 4) * i;
      const y = (this.height / 4) * i;
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }

    this.ctx.strokeStyle = '#666';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([5, 5]);
    this.ctx.beginPath();
    this.ctx.moveTo(0, this.height);
    this.ctx.lineTo(this.width, 0);
    this.ctx.stroke();
    this.ctx.setLineDash([]);

    const lut = this.buildCurveLUT();
    this.ctx.strokeStyle = '#fff';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    for (let i = 0; i < 256; i++) {
      const x = i;
      const y = this.height - lut[i];
      if (i === 0) {
        this.ctx.moveTo(x, y);
      } else {
        this.ctx.lineTo(x, y);
      }
    }
    this.ctx.stroke();

    this.points.forEach((point, index) => {
      const x = point[0];
      const y = this.height - point[1];

      this.ctx.fillStyle = index === this.selectedPoint ? '#4CAF50' : '#fff';
      this.ctx.beginPath();
      this.ctx.arc(x, y, 5, 0, 2 * Math.PI);
      this.ctx.fill();
      this.ctx.strokeStyle = '#000';
      this.ctx.lineWidth = 1;
      this.ctx.stroke();
    });
  }

  setPoints(points) {
    if (!points || points.length < 2) {
      this.points = [[0, 0], [255, 255]];
    } else {
      this.points = JSON.parse(JSON.stringify(points));
      this.points.sort((a, b) => a[0] - b[0]);
    }
    this.render();
  }

  getPoints() {
    return JSON.parse(JSON.stringify(this.points));
  }

  reset() {
    this.points = [[0, 0], [255, 255]];
    this.render();
    if (this.onChange) {
      this.onChange(this.getPoints());
    }
  }
}
