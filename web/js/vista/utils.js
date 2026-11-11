export function coinciden(a, b) {
  return Boolean(a && b) && a.encendido === b.encendido && a.color === b.color && a.brillo === b.brillo;
}
