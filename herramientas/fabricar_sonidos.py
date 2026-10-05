"""
Fabrica los sonidos de los soldados de la batalla (public/sonidos/tropa/*.wav).

Cada sonido se monta por capas, como se graba un disparo de verdad: el chasquido del principio,
el cuerpo (el estampido), el golpe grave que se siente en el pecho y la cola (el eco del sitio).
Cada tipo cambia las capas: el rifle restalla seco y largo, la escopeta retumba, el cañón y la
dinamita son graves y largos, la ametralladora es un "pop" muy corto, el golpe de cerca es un
zas de aire y un golpe sordo, la flecha es la cuerda y el silbido, y el escudo roto suena a
chapa y cristal que revientan.

Todo es del juego (no hay grabaciones de nadie): se puede regenerar cuando se quiera.

    python3 -m venv .venv && .venv/bin/pip install numpy scipy
    .venv/bin/python herramientas/fabricar_sonidos.py
"""

import os
import wave

import numpy as np
from scipy import signal

SR = 44100
SALIDA = os.path.join(os.path.dirname(__file__), '..', 'public', 'sonidos', 'tropa')
rng = np.random.default_rng(7)


def t(segundos):
    return np.arange(int(segundos * SR)) / SR


def ruido(segundos):
    return rng.standard_normal(int(segundos * SR))


def cae(segundos, tau, ataque=0.0005):
    x = t(segundos)
    env = np.exp(-x / tau)
    if ataque > 0:
        env *= np.minimum(1, x / ataque)
    return env


def filtro(x, tipo, hz, orden=4):
    nyq = SR / 2
    if isinstance(hz, (list, tuple)):
        sos = signal.butter(orden, [hz[0] / nyq, hz[1] / nyq], btype=tipo, output='sos')
    else:
        sos = signal.butter(orden, hz / nyq, btype=tipo, output='sos')
    return signal.sosfilt(sos, x)


def barrido(segundos, de, a, tau_f):
    """Un tono que cae de `de` a `a` Hz (el golpe grave)."""
    x = t(segundos)
    f = a + (de - a) * np.exp(-x / tau_f)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def mezcla(largo, *capas):
    out = np.zeros(int(largo * SR))
    for capa, desde in capas:
        i = int(desde * SR)
        n = min(len(capa), len(out) - i)
        if n > 0:
            out[i:i + n] += capa[:n]
    return out


def eco(x, segundos, tau, cantidad, brillo=2500):
    """La cola del sitio: el sonido rebotando (un poco de reverberación)."""
    ir = ruido(segundos) * np.exp(-t(segundos) / tau)
    ir = filtro(ir, 'lowpass', brillo)
    ir[0] = 0
    mojado = signal.fftconvolve(x, ir)[: len(x) + len(ir)]
    seco = np.concatenate([x, np.zeros(len(ir))])[: len(mojado)]
    mojado /= np.max(np.abs(mojado)) + 1e-9
    return seco + mojado * cantidad * np.max(np.abs(x))


def guardar(nombre, x, pico=0.9):
    x = x - np.mean(x)
    # Sin el grave que ningún altavoz pequeño da (solo gastaría volumen), y un poco saturado para
    # que pegue más (como un disparo grabado de cerca).
    x = filtro(x, 'highpass', 75)
    x = x / (np.max(np.abs(x)) + 1e-9)
    x = np.tanh(2.2 * x) / np.tanh(2.2)
    # Que no acabe de golpe.
    final = min(len(x), int(0.02 * SR))
    x[-final:] *= np.linspace(1, 0, final)
    x = x / (np.max(np.abs(x)) + 1e-9) * pico
    datos = (x * 32767).astype(np.int16)
    os.makedirs(SALIDA, exist_ok=True)
    with wave.open(os.path.join(SALIDA, f'{nombre}.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(datos.tobytes())


def chasquido(dura=0.006, hz=2500, tau=0.0012, fuerza=1.0):
    return filtro(ruido(dura), 'highpass', hz) * cae(dura, tau, 0.0001) * fuerza


def cuerpo(dura, banda, tau, fuerza=1.0, ataque=0.001):
    return filtro(ruido(dura), 'bandpass', banda) * cae(dura, tau, ataque) * fuerza


def grave(dura, de, a, tau, fuerza=1.0):
    return barrido(dura, de, a, tau * 0.6) * cae(dura, tau, 0.002) * fuerza


def revolver():
    x = mezcla(0.3, (chasquido(fuerza=1.1), 0), (cuerpo(0.25, (350, 3200), 0.035, 0.9), 0.001), (grave(0.2, 160, 55, 0.045, 0.7), 0.001))
    return eco(x, 0.45, 0.12, 0.35)


def rifle():
    restallido = chasquido(0.004, 3500, 0.0008, 1.4)
    x = mezcla(0.45, (restallido, 0), (cuerpo(0.3, (700, 5500), 0.022, 0.8), 0.0008), (grave(0.25, 120, 45, 0.05, 0.5), 0.001))
    # El eco del valle: un rebote seco a lo lejos.
    rebote = filtro(x, 'lowpass', 1800) * 0.28
    x = mezcla(0.75, (x, 0), (rebote, 0.13))
    return eco(x, 0.7, 0.2, 0.4, 2200)


def escopeta():
    x = mezcla(
        0.5,
        (chasquido(0.008, 1800, 0.002, 0.7), 0),
        (filtro(ruido(0.45), 'lowpass', 2200) * cae(0.45, 0.085, 0.002), 0.001),
        (grave(0.4, 110, 50, 0.12, 0.55), 0.002),
        (cuerpo(0.35, (250, 2200), 0.07, 0.8), 0.001),
    )
    return eco(x, 0.6, 0.16, 0.4, 1800)


def canon():
    x = mezcla(
        1.4,
        (filtro(ruido(0.02), 'lowpass', 1500) * cae(0.02, 0.006), 0),
        (grave(1.2, 90, 40, 0.38, 0.5), 0.003),
        (filtro(ruido(1.2), 'lowpass', 650) * cae(1.2, 0.3, 0.004) * 0.8, 0.002),
        # Lo que se oye en el altavoz de un móvil (no llega a los graves de verdad).
        (cuerpo(0.8, (180, 1400), 0.16, 0.9, 0.003), 0.001),
    )
    return eco(x, 1.2, 0.4, 0.5, 900)


def dinamita():
    dura = 1.3
    n = ruido(dura)
    # El fogonazo empieza brillante y se apaga a grave.
    claro = filtro(n, 'lowpass', 3200) * cae(dura, 0.08, 0.002)
    oscuro = filtro(n, 'lowpass', 420) * cae(dura, 0.42, 0.006)
    medio = cuerpo(dura, (200, 1800), 0.2, 0.9, 0.004)
    x = mezcla(dura, (claro * 0.8, 0), (oscuro, 0), (medio, 0), (grave(1.1, 85, 40, 0.5, 0.45), 0.004))
    # Cascotes que caen.
    for _ in range(14):
        i = rng.uniform(0.12, 0.9)
        x = mezcla(dura, (x, 0), (chasquido(0.004, 1500, 0.0015, rng.uniform(0.05, 0.18)), i))
    return eco(x, 1.0, 0.35, 0.45, 1000)


def gatling():
    pop = mezcla(0.16, (chasquido(0.004, 3000, 0.0009, 0.9), 0), (cuerpo(0.12, (800, 4200), 0.014, 0.8), 0.0005), (grave(0.08, 210, 110, 0.018, 0.5), 0.001))
    timbre = np.sin(2 * np.pi * 2150 * t(0.12)) * cae(0.12, 0.03) * 0.12
    return eco(mezcla(0.16, (pop, 0), (timbre, 0.002)), 0.2, 0.05, 0.2)


def golpe():
    zas_dura = 0.16
    x_zas = t(zas_dura)
    zas = ruido(zas_dura)
    # El aire: un barrido de agudo a grave que sube y se corta en el golpe.
    zas = signal.sosfilt(signal.butter(2, [900 / (SR / 2), 3200 / (SR / 2)], 'bandpass', output='sos'), zas)
    zas *= np.sin(np.pi * x_zas / zas_dura) ** 2 * 0.5
    seco = mezcla(0.3, (grave(0.25, 160, 70, 0.06, 0.6), 0), (cuerpo(0.12, (300, 1600), 0.03, 0.7), 0), (filtro(ruido(0.1), 'lowpass', 900) * cae(0.1, 0.025, 0.0005) * 0.9, 0))
    return eco(mezcla(0.42, (zas, 0), (seco, zas_dura * 0.85)), 0.3, 0.08, 0.2, 1500)


def flecha():
    # La cuerda (Karplus-Strong) y el silbido de la flecha al salir.
    dura = 0.42
    n = int(dura * SR)
    periodo = int(SR / 165)
    cuerda = np.zeros(n)
    buf = rng.uniform(-1, 1, periodo)
    for i in range(n):
        cuerda[i] = buf[i % periodo]
        buf[i % periodo] = 0.996 * 0.5 * (buf[i % periodo] + buf[(i + 1) % periodo])
    cuerda = filtro(cuerda, 'lowpass', 2500) * cae(dura, 0.12, 0.0005) * 0.7
    silbido = filtro(ruido(dura), 'bandpass', (2600, 7000)) * np.sin(np.pi * np.minimum(1, t(dura) / 0.3)) ** 2 * cae(dura, 0.18) * 0.35
    return mezcla(dura, (cuerda, 0), (silbido, 0.01))


def escudo():
    """El escudo que revienta: chapa y cristal (tonos sueltos y agudos que no casan) y esquirlas."""
    dura = 0.55
    x = mezcla(dura, (chasquido(0.006, 4000, 0.0015, 1.0), 0))
    for k, hz in enumerate([1870, 2640, 3310, 4170, 5230, 6380]):
        tono = np.sin(2 * np.pi * hz * t(dura) + rng.uniform(0, 6)) * cae(dura, rng.uniform(0.05, 0.16), 0.0003)
        x = mezcla(dura, (x, 0), (tono * (0.55 - k * 0.06), 0))
    for _ in range(7):
        hz = rng.uniform(3000, 7500)
        esquirla = np.sin(2 * np.pi * hz * t(0.05)) * cae(0.05, 0.01, 0.0002) * rng.uniform(0.1, 0.3)
        x = mezcla(dura, (x, 0), (esquirla, rng.uniform(0.02, 0.22)))
    golpecito = grave(0.1, 300, 140, 0.03, 0.4)
    return eco(mezcla(dura, (x, 0), (golpecito, 0)), 0.35, 0.09, 0.25, 6000)


if __name__ == '__main__':
    for nombre, fabrica in [
        ('revolver', revolver),
        ('rifle', rifle),
        ('escopeta', escopeta),
        ('canon', canon),
        ('dinamita', dinamita),
        ('gatling', gatling),
        ('golpe', golpe),
        ('flecha', flecha),
        ('escudo', escudo),
    ]:
        guardar(nombre, fabrica())
        print('hecho', nombre)
