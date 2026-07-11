import { reduceOrbit, type OrbitAction, type OrbitCameraState } from "./camera-math";

export class OrbitControlsBridge {
  private pointerId: number | null = null;
  private last = { x: 0, y: 0 };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly read: () => OrbitCameraState,
    private readonly write: (state: OrbitCameraState) => void,
    private readonly allowLeftPan = true,
  ) {
    canvas.addEventListener("pointerdown", this.onPointerDown);
    canvas.addEventListener("pointermove", this.onPointerMove);
    canvas.addEventListener("pointerup", this.onPointerUp);
    canvas.addEventListener("pointercancel", this.onPointerUp);
    canvas.addEventListener("wheel", this.onWheel, { passive: false });
    canvas.addEventListener("contextmenu", this.preventContextMenu);
  }

  private dispatch(action: OrbitAction): void {
    this.write(reduceOrbit(this.read(), action));
  }

  private onPointerDown = (event: PointerEvent): void => {
    this.pointerId = event.pointerId;
    this.last = { x: event.clientX, y: event.clientY };
    this.canvas.setPointerCapture(event.pointerId);
  };

  private onPointerMove = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    const dx = event.clientX - this.last.x;
    const dy = event.clientY - this.last.y;
    this.last = { x: event.clientX, y: event.clientY };
    if (event.button === 1 || event.button === 2 || event.buttons === 2 || event.altKey) {
      this.dispatch({ type: "orbit", deltaYaw: -dx * 0.28, deltaPitch: dy * 0.22 });
      return;
    }
    if (!this.allowLeftPan) return;
    const state = this.read();
    const scale = state.distance * 0.0015;
    const yaw = state.yaw * (Math.PI / 180);
    this.dispatch({
      type: "pan",
      dx: (-dx * Math.cos(yaw) - dy * Math.sin(yaw)) * scale,
      dz: (dx * Math.sin(yaw) - dy * Math.cos(yaw)) * scale,
    });
  };

  private onPointerUp = (event: PointerEvent): void => {
    if (event.pointerId !== this.pointerId) return;
    try { this.canvas.releasePointerCapture(event.pointerId); } catch {}
    this.pointerId = null;
  };

  private onWheel = (event: WheelEvent): void => {
    event.preventDefault();
    this.dispatch({ type: "dolly", factor: Math.exp(event.deltaY * 0.001) });
  };

  private preventContextMenu = (event: Event): void => event.preventDefault();

  dispose(): void {
    this.canvas.removeEventListener("pointerdown", this.onPointerDown);
    this.canvas.removeEventListener("pointermove", this.onPointerMove);
    this.canvas.removeEventListener("pointerup", this.onPointerUp);
    this.canvas.removeEventListener("pointercancel", this.onPointerUp);
    this.canvas.removeEventListener("wheel", this.onWheel);
    this.canvas.removeEventListener("contextmenu", this.preventContextMenu);
  }
}
