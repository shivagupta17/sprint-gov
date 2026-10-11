import test from 'node:test';
import assert from 'node:assert/strict';

// Mirror of SprintStories filtering and calculation logic
function filterStories(stories, {searchKeyword = '', filterEpic = '', filterAssignee = ''} = {}) {
  const kw = searchKeyword.toLowerCase().trim();
  return stories.filter(story => {
    if (kw) {
      const matchesNum = (story.number || '').toLowerCase().includes(kw);
      const matchesDesc = (story.short_description || '').toLowerCase().includes(kw);
      if (!matchesNum && !matchesDesc) return false;
    }
    if (filterEpic && story.epic !== filterEpic) return false;
    if (filterAssignee && story.assigned_to !== filterAssignee) return false;
    return true;
  });
}

function calculatePoints(stories) {
  return stories.reduce((sum, s) => sum + (Number(s.story_points) || 0), 0);
}

const mockStories = [
  {
    sys_id: 's1',
    number: 'STRY001',
    short_description: 'Login page authentication',
    story_points: '5',
    epic: 'e1',
    assigned_to: 'u1'
  },
  {
    sys_id: 's2',
    number: 'STRY002',
    short_description: 'Password reset flow',
    story_points: '3',
    epic: 'e1',
    assigned_to: 'u2'
  },
  {
    sys_id: 's3',
    number: 'STRY003',
    short_description: 'Dashboard KPI metrics',
    story_points: '8',
    epic: 'e2',
    assigned_to: 'u1'
  },
  {
    sys_id: 's4',
    number: 'STRY004',
    short_description: 'API rate limiter',
    story_points: '0',
    epic: '',
    assigned_to: ''
  }
];

test('SprintStories - search filtering matches number or description', () => {
  const byNum = filterStories(mockStories, {searchKeyword: 'STRY001'});
  assert.equal(byNum.length, 1);
  assert.equal(byNum[0].number, 'STRY001');

  const byDesc = filterStories(mockStories, {searchKeyword: 'dashboard'});
  assert.equal(byDesc.length, 1);
  assert.equal(byDesc[0].number, 'STRY003');

  const noMatch = filterStories(mockStories, {searchKeyword: 'nonexistent'});
  assert.equal(noMatch.length, 0);
});

test('SprintStories - epic filtering', () => {
  const e1Stories = filterStories(mockStories, {filterEpic: 'e1'});
  assert.equal(e1Stories.length, 2);
  assert.deepEqual(e1Stories.map(s => s.number), ['STRY001', 'STRY002']);

  const e2Stories = filterStories(mockStories, {filterEpic: 'e2'});
  assert.equal(e2Stories.length, 1);
  assert.equal(e2Stories[0].number, 'STRY003');
});

test('SprintStories - assignee filtering', () => {
  const u1Stories = filterStories(mockStories, {filterAssignee: 'u1'});
  assert.equal(u1Stories.length, 2);
  assert.deepEqual(u1Stories.map(s => s.number), ['STRY001', 'STRY003']);

  const u2Stories = filterStories(mockStories, {filterAssignee: 'u2'});
  assert.equal(u2Stories.length, 1);
  assert.equal(u2Stories[0].number, 'STRY002');
});

test('SprintStories - combined filtering', () => {
  const combined = filterStories(mockStories, {
    searchKeyword: 'page',
    filterEpic: 'e1',
    filterAssignee: 'u1'
  });
  assert.equal(combined.length, 1);
  assert.equal(combined[0].number, 'STRY001');
});

test('SprintStories - calculatePoints aggregates story points correctly', () => {
  assert.equal(calculatePoints(mockStories), 16);
  assert.equal(calculatePoints([]), 0);
  assert.equal(calculatePoints([{story_points: ''}, {story_points: 'invalid'}, {story_points: '5'}]), 5);
});

test('SprintStories - moveStory moves story between backlog and sprint lists', () => {
  let backlog = [...mockStories];
  let sprint = [];

  // Move s1 from backlog to sprint
  const targetId = 's1';
  const storyToMove = backlog.find(s => s.sys_id === targetId);
  backlog = backlog.filter(s => s.sys_id !== targetId);
  sprint = [...sprint, {...storyToMove, sprint: 'sprint_123'}];

  assert.equal(backlog.length, 3);
  assert.equal(sprint.length, 1);
  assert.equal(sprint[0].number, 'STRY001');
  assert.equal(calculatePoints(sprint), 5);
  assert.equal(calculatePoints(backlog), 11);

  // Move s1 back to backlog
  const storyBack = sprint.find(s => s.sys_id === targetId);
  sprint = sprint.filter(s => s.sys_id !== targetId);
  backlog = [...backlog, {...storyBack, sprint: ''}];

  assert.equal(sprint.length, 0);
  assert.equal(backlog.length, 4);
  assert.equal(calculatePoints(backlog), 16);
});
