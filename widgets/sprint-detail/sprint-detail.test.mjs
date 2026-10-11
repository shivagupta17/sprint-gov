import test from 'node:test';
import assert from 'node:assert/strict';

// Logic mirror of SprintDetail calculation methods
class SprintDetailCapacityCalculator {
  constructor(members = []) {
    this.members = members.map(m => ({
      ...m,
      reduce_points: ''
    }));
  }

  handleReducePointsInput(sysId, rawValue) {
    this.members = this.members.map(member => {
      if (member.sys_id === sysId) {
        return {
          ...member,
          reduce_points: rawValue
        };
      }
      return member;
    });
  }

  resetReducePoints() {
    this.members = this.members.map(member => ({
      ...member,
      reduce_points: ''
    }));
  }

  get totalAveragePoints() {
    return this.members.reduce((sum, m) => sum + (Number(m.average_points) || 0), 0);
  }

  get totalReducePoints() {
    return this.members.reduce((sum, m) => {
      const val = Number(m.reduce_points);
      return sum + (Number.isFinite(val) && val > 0 ? val : 0);
    }, 0);
  }

  get calculatedGroupCapacity() {
    const total = this.members.reduce((sum, m) => {
      const avg = Number(m.average_points) || 0;
      const red = Number(m.reduce_points);
      const reduceVal = Number.isFinite(red) && red > 0 ? red : 0;
      return sum + Math.max(0, avg - reduceVal);
    }, 0);
    return Math.round(total);
  }
}

test('SprintDetail Capacity Calculator - initial state', () => {
  const members = [
    { sys_id: '1', user_name: 'Alice', average_points: '14' },
    { sys_id: '2', user_name: 'Bob', average_points: '14' },
    { sys_id: '3', user_name: 'Charlie', average_points: '14' },
    { sys_id: '4', user_name: 'Dave', average_points: '14' },
    { sys_id: '5', user_name: 'Eve', average_points: '14' }
  ];

  const calc = new SprintDetailCapacityCalculator(members);
  assert.equal(calc.totalAveragePoints, 70);
  assert.equal(calc.totalReducePoints, 0);
  assert.equal(calc.calculatedGroupCapacity, 70);
});

test('SprintDetail Capacity Calculator - reduce points on a single member', () => {
  const members = [
    { sys_id: '1', user_name: 'Alice', average_points: '14' },
    { sys_id: '2', user_name: 'Bob', average_points: '14' }
  ];

  const calc = new SprintDetailCapacityCalculator(members);
  calc.handleReducePointsInput('1', '4');

  assert.equal(calc.totalAveragePoints, 28);
  assert.equal(calc.totalReducePoints, 4);
  assert.equal(calc.calculatedGroupCapacity, 24);
});

test('SprintDetail Capacity Calculator - reduce points on multiple members', () => {
  const members = [
    { sys_id: '1', user_name: 'Alice', average_points: '10' },
    { sys_id: '2', user_name: 'Bob', average_points: '12' },
    { sys_id: '3', user_name: 'Charlie', average_points: '8' }
  ];

  const calc = new SprintDetailCapacityCalculator(members);
  calc.handleReducePointsInput('1', '3');
  calc.handleReducePointsInput('2', '2');
  calc.handleReducePointsInput('3', '1');

  assert.equal(calc.totalAveragePoints, 30);
  assert.equal(calc.totalReducePoints, 6);
  assert.equal(calc.calculatedGroupCapacity, 24);
});

test('SprintDetail Capacity Calculator - reduce points exceeding member average is clamped to 0', () => {
  const members = [
    { sys_id: '1', user_name: 'Alice', average_points: '10' },
    { sys_id: '2', user_name: 'Bob', average_points: '10' }
  ];

  const calc = new SprintDetailCapacityCalculator(members);
  calc.handleReducePointsInput('1', '15');

  assert.equal(calc.totalAveragePoints, 20);
  assert.equal(calc.totalReducePoints, 15);
  assert.equal(calc.calculatedGroupCapacity, 10);
});

test('SprintDetail Capacity Calculator - reset clears reduce points', () => {
  const members = [
    { sys_id: '1', user_name: 'Alice', average_points: '14' },
    { sys_id: '2', user_name: 'Bob', average_points: '14' }
  ];

  const calc = new SprintDetailCapacityCalculator(members);
  calc.handleReducePointsInput('1', '6');
  assert.equal(calc.calculatedGroupCapacity, 22);

  calc.resetReducePoints();
  assert.equal(calc.totalReducePoints, 0);
  assert.equal(calc.calculatedGroupCapacity, 28);
});

test('SprintDetail Capacity Calculator - invalid / empty inputs handled gracefully', () => {
  const members = [
    { sys_id: '1', user_name: 'Alice', average_points: '10' }
  ];

  const calc = new SprintDetailCapacityCalculator(members);
  calc.handleReducePointsInput('1', '');
  assert.equal(calc.calculatedGroupCapacity, 10);

  calc.handleReducePointsInput('1', '-5');
  assert.equal(calc.totalReducePoints, 0);
  assert.equal(calc.calculatedGroupCapacity, 10);
});
