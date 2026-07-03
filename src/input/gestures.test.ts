import { describe, it, expect, vi } from 'vitest';
import { GestureRecognizer, TAP_MS, type GestureEvent } from './gestures.ts';

type Cb = {
  onPinchPan: ReturnType<typeof vi.fn>;
  onPinchEnd: ReturnType<typeof vi.fn>;
  onTap: ReturnType<typeof vi.fn>;
};

function setup(): { g: GestureRecognizer; cb: Cb } {
  const cb: Cb = { onPinchPan: vi.fn(), onPinchEnd: vi.fn(), onTap: vi.fn() };
  return { g: new GestureRecognizer(cb), cb };
}

const ev = (type: GestureEvent['type'], id: number, x: number, y: number, t: number): GestureEvent =>
  ({ type, id, x, y, t });

describe('tap de 2 y 3 dedos', () => {
  it('2 dedos que bajan y suben rápido sin moverse → tap(2)', () => {
    const { g, cb } = setup();
    g.handle(ev('down', 1, 100, 100, 0));
    g.handle(ev('down', 2, 150, 100, 10));
    g.handle(ev('up', 1, 100, 100, 120));
    g.handle(ev('up', 2, 150, 100, 130));
    expect(cb.onTap).toHaveBeenCalledTimes(1);
    expect(cb.onTap).toHaveBeenCalledWith(2);
    expect(cb.onPinchPan).not.toHaveBeenCalled();
  });

  it('3 dedos → tap(3), aunque no suelten exactamente a la vez', () => {
    const { g, cb } = setup();
    g.handle(ev('down', 1, 100, 100, 0));
    g.handle(ev('down', 2, 150, 100, 5));
    g.handle(ev('down', 3, 200, 100, 10));
    g.handle(ev('up', 2, 150, 100, 90));
    g.handle(ev('up', 1, 100, 100, 100));
    g.handle(ev('up', 3, 200, 100, 110));
    expect(cb.onTap).toHaveBeenCalledTimes(1);
    expect(cb.onTap).toHaveBeenCalledWith(3);
  });

  it('1 dedo nunca emite tap', () => {
    const { g, cb } = setup();
    g.handle(ev('down', 1, 100, 100, 0));
    g.handle(ev('up', 1, 100, 100, 50));
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it('si tarda más de TAP_MS no es tap', () => {
    const { g, cb } = setup();
    g.handle(ev('down', 1, 100, 100, 0));
    g.handle(ev('down', 2, 150, 100, 10));
    g.handle(ev('up', 1, 100, 100, TAP_MS + 50));
    g.handle(ev('up', 2, 150, 100, TAP_MS + 60));
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it('si los dedos se desplazan no es tap', () => {
    const { g, cb } = setup();
    g.handle(ev('down', 1, 100, 100, 0));
    g.handle(ev('down', 2, 150, 100, 10));
    g.handle(ev('move', 1, 130, 100, 50)); // 30 px > TAP_SLOP
    g.handle(ev('up', 1, 130, 100, 100));
    g.handle(ev('up', 2, 150, 100, 110));
    expect(cb.onTap).not.toHaveBeenCalled();
  });
});

describe('pinch/pan', () => {
  it('2 dedos que se separan emiten pinchPan con factor > 1', () => {
    const { g, cb } = setup();
    g.handle(ev('down', 1, 100, 100, 0));
    g.handle(ev('down', 2, 200, 100, 5));
    g.handle(ev('move', 1, 80, 100, 20)); // supera PAN_SLOP → entra en pinch
    g.handle(ev('move', 2, 240, 100, 30));
    expect(cb.onPinchPan).toHaveBeenCalled();
    const factors = cb.onPinchPan.mock.calls.map((c) => c[3] as number);
    expect(Math.max(...factors)).toBeGreaterThan(1);
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it('2 dedos que se trasladan juntos emiten pan neto sin zoom neto', () => {
    const { g, cb } = setup();
    g.handle(ev('down', 1, 100, 100, 0));
    g.handle(ev('down', 2, 200, 100, 5));
    // Traslación de +60 px en pasos pequeños alternados, como los eventos reales.
    let t = 10;
    for (let step = 1; step <= 20; step++) {
      g.handle(ev('move', 1, 100 + step * 3, 100, (t += 5)));
      g.handle(ev('move', 2, 200 + step * 3, 100, (t += 5)));
    }
    const calls = cb.onPinchPan.mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    // Pan neto: gran parte de los 60 px (se descarta solo el tramo del slop).
    const totalDx = calls.reduce((acc, c) => acc + (c[1] as number), 0);
    expect(totalDx).toBeGreaterThan(40);
    // Zoom neto ≈ 1 (tolerancia por el tramo de slop descartado al entrar).
    const netScale = calls.reduce((acc, c) => acc * (c[3] as number), 1);
    expect(netScale).toBeCloseTo(1, 1);
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it('mantener 2 dedos quietos más de TAP_MS y mover después → pinch, no tap', () => {
    const { g, cb } = setup();
    g.handle(ev('down', 1, 100, 100, 0));
    g.handle(ev('down', 2, 200, 100, 5));
    g.handle(ev('move', 1, 101, 100, TAP_MS + 20)); // timeout → pinch
    g.handle(ev('move', 1, 120, 100, TAP_MS + 40));
    expect(cb.onPinchPan).toHaveBeenCalled();
    g.handle(ev('up', 1, 120, 100, TAP_MS + 60));
    expect(cb.onPinchEnd).toHaveBeenCalledOnce();
    expect(cb.onTap).not.toHaveBeenCalled();
  });

  it('al bajar de 2 dedos termina el pinch y no rearranca con el dedo restante', () => {
    const { g, cb } = setup();
    g.handle(ev('down', 1, 100, 100, 0));
    g.handle(ev('down', 2, 200, 100, 5));
    g.handle(ev('move', 1, 60, 100, 20));
    g.handle(ev('up', 1, 60, 100, 40));
    expect(cb.onPinchEnd).toHaveBeenCalledOnce();
    cb.onPinchPan.mockClear();
    g.handle(ev('move', 2, 300, 100, 60));
    expect(cb.onPinchPan).not.toHaveBeenCalled();
  });
});

describe('prioridad del pen', () => {
  it('penDown cancela un gesto pendiente: ni tap ni pinch', () => {
    const { g, cb } = setup();
    g.handle(ev('down', 1, 100, 100, 0));
    g.handle(ev('down', 2, 150, 100, 5));
    g.penDown();
    g.handle(ev('up', 1, 100, 100, 50));
    g.handle(ev('up', 2, 150, 100, 60));
    expect(cb.onTap).not.toHaveBeenCalled();
    expect(cb.onPinchPan).not.toHaveBeenCalled();
  });

  it('penDown durante un pinch emite pinchEnd y lo mata', () => {
    const { g, cb } = setup();
    g.handle(ev('down', 1, 100, 100, 0));
    g.handle(ev('down', 2, 200, 100, 5));
    g.handle(ev('move', 1, 60, 100, 20));
    g.penDown();
    expect(cb.onPinchEnd).toHaveBeenCalledOnce();
    cb.onPinchPan.mockClear();
    g.handle(ev('move', 2, 300, 100, 40));
    expect(cb.onPinchPan).not.toHaveBeenCalled();
  });

  it('tras quedar 0 dedos vuelve a reconocer gestos', () => {
    const { g, cb } = setup();
    g.handle(ev('down', 1, 100, 100, 0));
    g.penDown(); // dead
    g.handle(ev('up', 1, 100, 100, 30)); // 0 dedos → idle
    g.handle(ev('down', 1, 100, 100, 100));
    g.handle(ev('down', 2, 150, 100, 105));
    g.handle(ev('up', 1, 100, 100, 150));
    g.handle(ev('up', 2, 150, 100, 160));
    expect(cb.onTap).toHaveBeenCalledTimes(1);
    expect(cb.onTap).toHaveBeenCalledWith(2);
  });
});
