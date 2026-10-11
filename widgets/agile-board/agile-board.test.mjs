import test from 'node:test';
import assert from 'node:assert/strict';

// Story filtering logic including member chip filter
function filterBoardStories(stories, {searchKeyword = '', selectedMemberId = '', dueByFilter = 'all', referenceDate = '2026-10-10'} = {}) {
  const kw = searchKeyword.toLowerCase().trim();
  return stories.filter(story => {
    // 1. Team member chip filter
    if (selectedMemberId && story.assigned_to !== selectedMemberId) {
      return false;
    }
    // 2. Search keyword filter
    if (kw) {
      const matchesNum = (story.number || '').toLowerCase().includes(kw);
      const matchesDesc = (story.short_description || '').toLowerCase().includes(kw);
      if (!matchesNum && !matchesDesc) return false;
    }
    // 3. Due by filter
    if (dueByFilter !== 'all') {
      const d = story.due_date;
      if (dueByFilter === 'no_due_date') {
        if (d) return false;
      } else if (!d) {
        return false;
      } else {
        const dateOnly = d.split(' ')[0];
        if (dueByFilter === 'overdue' && dateOnly >= referenceDate) return false;
        if (dueByFilter === 'today' && dateOnly !== referenceDate) return false;
      }
    }
    return true;
  });
}

// Closest sprint selection helper
function selectActiveOrClosestSprint(sprints, nowMs = 1791600000000) {
  if (!sprints || sprints.length === 0) return '';
  // 1. Current sprint
  for (const s of sprints) {
    if (s.state === '2') return s.sys_id;
  }
  // 2. Closest sprint
  let closestId = sprints[0].sys_id;
  let minDiff = Infinity;
  for (const s of sprints) {
    const raw = s.start_date_raw || s.end_date_raw;
    if (raw) {
      const sprintMs = new Date(raw).getTime();
      const diff = Math.abs(sprintMs - nowMs);
      if (diff < minDiff) {
        minDiff = diff;
        closestId = s.sys_id;
      }
    }
  }
  return closestId;
}

// Swimlanes generator for all group members / epics / choices
function generateSwimlanes(field, {members = [], epics = [], priorityChoices = []} = {}) {
  if (field === 'assigned_to') {
    return [
      {id: 'unassigned', title: 'No Assigned to'},
      ...members.map(m => ({
        id: m.id,
        title: m.name,
        avatarInitials: m.initials
      }))
    ];
  }
  if (field === 'epic') {
    return [
      {id: 'no_epic', title: 'No Epic'},
      ...epics.map(e => ({
        id: e.id,
        title: e.name
      }))
    ];
  }
  if (field === 'priority') {
    return priorityChoices.map(p => ({
      id: p.value,
      title: p.label || p.value
    }));
  }
  return [];
}

// Cards transformer for aiux-visual-board
function getCards(stories, {verticalLaneField = 'state', swimlaneField = 'none'} = {}) {
  return stories.map((story, index) => {
    let laneId = story.state;
    if (verticalLaneField === 'priority') {
      laneId = story.priority;
    }

    let swimlaneId;
    if (swimlaneField === 'assigned_to') {
      swimlaneId = story.assigned_to || 'unassigned';
    } else if (swimlaneField === 'epic') {
      swimlaneId = story.epic || 'no_epic';
    } else if (swimlaneField === 'priority') {
      swimlaneId = story.priority || '3';
    }

    return {
      id: story.sys_id,
      title: story.short_description,
      order: index,
      laneId,
      ...(swimlaneId ? {swimlaneId} : {}),
      slotsData: {
        metadata: {
          fields: {
            number: {value: story.number, displayValue: story.number},
            points: {value: story.story_points, displayValue: `${story.story_points || '0'} pts`},
            priority: {value: story.priority_label, displayValue: story.priority_label || ''}
          }
        },
        assignee: {
          value: story.assigned_to,
          displayValue: story.assigned_to_name || 'Unassigned',
          avatar: ''
        },
        due_date: {
          value: story.due_date,
          displayValue: story.due_date || '—'
        },
        epic: {
          value: story.epic,
          displayValue: story.epic_name || '—'
        }
      }
    };
  });
}

test('AgileBoard - Team Member Chip filter toggles', () => {
  const sampleStories = [
    {sys_id: '1', number: 'STRY001', short_description: 'Task 1', assigned_to: 'u1'},
    {sys_id: '2', number: 'STRY002', short_description: 'Task 2', assigned_to: 'u2'},
    {sys_id: '3', number: 'STRY003', short_description: 'Task 3', assigned_to: 'u1'}
  ];

  // When u1 is selected: returns stories assigned to u1
  const u1Filtered = filterBoardStories(sampleStories, {selectedMemberId: 'u1'});
  assert.equal(u1Filtered.length, 2);
  assert.equal(u1Filtered[0].assigned_to, 'u1');

  // When toggled off (empty string): returns all stories
  const unselected = filterBoardStories(sampleStories, {selectedMemberId: ''});
  assert.equal(unselected.length, 3);
});

test('AgileBoard - Sprint Selection defaults to Current or closest sprint', () => {
  const sprintsWithCurrent = [
    {sys_id: 's1', name: 'Sprint 1', state: '3', start_date_raw: '2026-08-01'},
    {sys_id: 's2', name: 'Sprint 2', state: '2', start_date_raw: '2026-09-01'},
    {sys_id: 's3', name: 'Sprint 3', state: '-6', start_date_raw: '2026-10-01'}
  ];

  // Prefers state 2 (Current)
  assert.equal(selectActiveOrClosestSprint(sprintsWithCurrent), 's2');

  // When no state 2, chooses closest to target date
  const sprintsWithoutCurrent = [
    {sys_id: 's1', name: 'Past Sprint', state: '3', start_date_raw: '2026-01-01'},
    {sys_id: 's3', name: 'Future Sprint', state: '-6', start_date_raw: '2026-10-08'},
    {sys_id: 's4', name: 'Distant Sprint', state: '-6', start_date_raw: '2026-12-01'}
  ];
  const targetMs = new Date('2026-10-10').getTime();
  assert.equal(selectActiveOrClosestSprint(sprintsWithoutCurrent, targetMs), 's3');
});

test('AgileBoard - Swimlane generation includes all team members and unassigned', () => {
  const members = [
    {id: 'm1', name: 'Abraham Lincoln', initials: 'AL'},
    {id: 'm2', name: 'Carol Coughlin', initials: 'CC'},
    {id: 'm3', name: 'Mack Jurasin', initials: 'MJ'}
  ];

  const swimlanes = generateSwimlanes('assigned_to', {members});
  assert.equal(swimlanes.length, 4);
  assert.equal(swimlanes[0].id, 'unassigned');
  assert.equal(swimlanes[1].id, 'm1');
  assert.equal(swimlanes[2].id, 'm2');
  assert.equal(swimlanes[3].id, 'm3');
});

test('AgileBoard - Card swimlane mapping for assigned_to and unassigned', () => {
  const stories = [
    {sys_id: 's1', number: 'STRY001', short_description: 'Task 1', assigned_to: 'm1', state: '1'},
    {sys_id: 's2', number: 'STRY002', short_description: 'Task 2', assigned_to: '', state: '-6'}
  ];

  const cards = getCards(stories, {swimlaneField: 'assigned_to'});
  assert.equal(cards[0].swimlaneId, 'm1');
  assert.equal(cards[1].swimlaneId, 'unassigned');
});
