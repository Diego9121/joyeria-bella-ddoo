import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extraerNumeroCodigo,
  calcularSiguienteNumero,
  construirCodigo,
  generarSiguienteCodigo,
} from './productCode.ts';

test('extraerNumeroCodigo: ignora códigos que no empiezan exactamente con el prefijo', () => {
  assert.equal(extraerNumeroCodigo('CM018', 'CM'), 18);
  assert.equal(extraerNumeroCodigo('C018', 'CM'), null); // prefijo distinto, no confundir "C" con "CM"
  assert.equal(extraerNumeroCodigo('CM018', 'C'), null); // "M018" no es solo dígitos
  assert.equal(extraerNumeroCodigo('CT045', 'CM'), null);
});

test('calcularSiguienteNumero: sin productos previos empieza en 1', () => {
  assert.equal(calcularSiguienteNumero([], 'CM'), 1);
});

test('calcularSiguienteNumero: secuencia normal sin huecos', () => {
  const codigos = ['CM001', 'CM002', 'CM003', 'CM004', 'CM005'];
  assert.equal(calcularSiguienteNumero(codigos, 'CM'), 6);
});

test('calcularSiguienteNumero: caso real con huecos (faltan 097 y 098) da 107, no 105 ni 97', () => {
  const codigos: string[] = [];
  for (let i = 1; i <= 96; i++) codigos.push(construirCodigo('CM', i));
  for (let i = 99; i <= 106; i++) codigos.push(construirCodigo('CM', i));

  assert.equal(codigos.includes('CM097'), false);
  assert.equal(codigos.includes('CM098'), false);
  assert.equal(calcularSiguienteNumero(codigos, 'CM'), 107);
});

test('calcularSiguienteNumero: el bug original (COUNT en vez de MAX) habría dado 105 en el caso con huecos', () => {
  const codigos: string[] = [];
  for (let i = 1; i <= 96; i++) codigos.push(construirCodigo('CM', i));
  for (let i = 99; i <= 106; i++) codigos.push(construirCodigo('CM', i));

  const countBasado = codigos.length + 1; // 96 + 8 = 104 productos -> 105 (comportamiento viejo, incorrecto)
  assert.equal(countBasado, 105);
  assert.notEqual(calcularSiguienteNumero(codigos, 'CM'), countBasado);
});

test('calcularSiguienteNumero: no confunde prefijos parecidos pero distintos', () => {
  // "C" (Collares sin subcategoría) y "CM" (Collares + Mixtos) no deben mezclarse
  const codigos = ['C001', 'C002', 'C003', 'CM050', 'CM051', 'CT010'];
  assert.equal(calcularSiguienteNumero(codigos, 'C'), 4);
  assert.equal(calcularSiguienteNumero(codigos, 'CM'), 52);
  assert.equal(calcularSiguienteNumero(codigos, 'CT'), 11);
});

test('construirCodigo: aplica el padding de 3 dígitos', () => {
  assert.equal(construirCodigo('AR', 1), 'AR001');
  assert.equal(construirCodigo('AR', 10), 'AR010');
  assert.equal(construirCodigo('AR', 105), 'AR105');
});

test('construirCodigo: no trunca cuando el número supera el padding', () => {
  assert.equal(construirCodigo('AR', 1000), 'AR1000');
});

test('generarSiguienteCodigo: integra cálculo + construcción', () => {
  assert.equal(generarSiguienteCodigo([], 'ARC'), 'ARC001');
  assert.equal(generarSiguienteCodigo(['ARC001', 'ARC002'], 'ARC'), 'ARC003');

  const conHuecos = ['CG001', 'CG002', 'CG005', 'CG006'];
  assert.equal(generarSiguienteCodigo(conHuecos, 'CG'), 'CG007');
});
