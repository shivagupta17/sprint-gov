var AGILE_TEAM_TYPE_ID = '1bff3b1493030200ea933007f67ffb6d';

export default function server(data, options, input) {
  try {
    var action = input && input.action ? input.action : 'details';
    var sysId = String((input && input.sysId) || (options && (options.sprintId || options['sprint-id'])) || '');
    if (!/^[0-9a-f]{32}$/i.test(sysId)) throw new Error(gs.getMessage('Select a valid sprint.'));

    var sprint = new GlideRecordSecure('rm_sprint');
    if (!sprint.get(sysId) || !sprint.canRead()) {
      throw new Error(gs.getMessage('Sprint not found or you do not have access to it.'));
    }

    var groupId = sprint.getValue('assignment_group');
    if (!isAgileTeamMember(groupId)) throw new Error(gs.getMessage('You must belong to the sprint’s Agile Team group to view its details.'));

    if (action === 'update_capacity') {
      updateCapacity(sprint, input.teamPoints);
      data.sprint = sprintDetails(sprint);
    } else if (action === 'get_group_members') {
      data.members = getGroupMembers(groupId);
    } else if (action === 'get_stories') {
      data.backlogStories = getBacklogStories(groupId);
      data.sprintStories = getSprintStories(groupId, sysId);
      data.filterOptions = getFilterOptions(groupId);
    } else if (action === 'move_story') {
      moveStory(input.storyId, input.targetSprint, groupId);
      sprint.get(sysId);
      data.sprint = sprintDetails(sprint);
      data.backlogStories = getBacklogStories(groupId);
      data.sprintStories = getSprintStories(groupId, sysId);
    } else if (action === 'assign_story') {
      assignStory(input.storyId, input.assignedTo, groupId);
      data.backlogStories = getBacklogStories(groupId);
      data.sprintStories = getSprintStories(groupId, sysId);
    } else if (action === 'update_story') {
      updateStory(input.storyId, input.field, input.value, groupId);
      sprint.get(sysId);
      data.sprint = sprintDetails(sprint);
      data.backlogStories = getBacklogStories(groupId);
      data.sprintStories = getSprintStories(groupId, sysId);
      data.filterOptions = getFilterOptions(groupId);
    } else if (action === 'create_story') {
      createStory(input, groupId, sysId);
      sprint.get(sysId);
      data.sprint = sprintDetails(sprint);
      data.backlogStories = getBacklogStories(groupId);
      data.sprintStories = getSprintStories(groupId, sysId);
      data.filterOptions = getFilterOptions(groupId);
    } else {
      data.sprint = sprintDetails(sprint);
    }
  } catch (error) {
    data.isError = true;
    data.errorMessage = error && error.message ? error.message : gs.getMessage('Could not load sprint details.');
  }

  function isAgileTeamMember(groupId) {
    if (!groupId) return false;
    var membership = new GlideRecordSecure('sys_user_grmember');
    membership.addQuery('user', gs.getUserID());
    membership.addQuery('group', groupId);
    membership.setLimit(1);
    membership.query();
    if (!membership.next()) return false;

    var group = new GlideRecordSecure('sys_user_group');
    if (!group.get(groupId) || !group.canRead()) return false;
    if (group.getValue('active') !== '1' && group.getValue('active') !== 'true') return false;
    return (',' + (group.getValue('type') || '') + ',').indexOf(',' + AGILE_TEAM_TYPE_ID + ',') !== -1;
  }

  function readableValue(record, fieldName) {
    if (!record.isValidField(fieldName)) return '';
    var element = record.getElement(fieldName);
    if (element && !element.canRead()) return '';
    return record.getDisplayValue(fieldName) || '';
  }

  function readableDate(record, fieldName) {
    if (!record.isValidField(fieldName)) return '';
    var element = record.getElement(fieldName);
    if (element && !element.canRead()) return '';
    var value = record.getValue(fieldName);
    return value ? new GlideDateTime(value).getDisplayValue() : '';
  }

  function updateCapacity(record, value) {
    var points = Number(value);
    if (value === null || value === undefined || String(value).trim() === '' || !isFinite(points) || points < 0) {
      throw new Error(gs.getMessage('Enter a valid non-negative group capacity.'));
    }
    if (record.getValue('state') !== '-6') {
      throw new Error(gs.getMessage('Group capacity points can only be changed while the sprint is Draft.'));
    }
    if (!record.canWrite() || !record.isValidField('team_points') || !record.getElement('team_points').canWrite()) {
      throw new Error(gs.getMessage('You do not have permission to update group capacity points.'));
    }
    record.setValue('team_points', String(points));
    if (!record.update()) throw new Error(gs.getMessage('Group capacity points could not be updated.'));
  }

  function sprintDetails(record) {
    return {
      sys_id: record.getUniqueValue(),
      number: readableValue(record, 'number'),
      name: readableValue(record, 'short_description') || gs.getMessage('Untitled sprint'),
      assignment_group: record.getDisplayValue('assignment_group'),
      assignment_group_id: record.getValue('assignment_group'),
      state: record.getValue('state') || '-6',
      state_label: record.getDisplayValue('state') || gs.getMessage('Draft'),
      start_date: readableDate(record, 'start_date'),
      end_date: readableDate(record, 'end_date'),
      team_points: readableValue(record, 'team_points'),
      committed_points: readableValue(record, 'committed_points'),
      story_points: readableValue(record, 'story_points'),
      actual_points: readableValue(record, 'actual_points'),
      description: readableValue(record, 'description')
    };
  }

  function getGroupMembers(groupId) {
    var members = [];
    var membership = new GlideRecordSecure('sys_user_grmember');
    membership.addQuery('group', groupId);
    membership.addQuery('user.active', 'true');
    membership.orderBy('user.name');
    membership.query();

    while (membership.next()) {
      var points = readableValue(membership, 'points');
      members.push({
        sys_id: membership.getUniqueValue(),
        user_id: membership.getValue('user'),
        user_name: membership.getDisplayValue('user') || '',
        average_points: points || '0'
      });
    }

    return members;
  }

  function formatStory(record) {
    return {
      sys_id: record.getUniqueValue(),
      number: record.getValue('number') || '',
      short_description: record.getValue('short_description') || '',
      story_points: record.getValue('story_points') || '0',
      assigned_to: record.getValue('assigned_to') || '',
      assigned_to_name: record.getDisplayValue('assigned_to') || '',
      epic: record.getValue('epic') || '',
      epic_name: record.getDisplayValue('epic') || '',
      priority: record.getValue('priority') || '3',
      priority_label: record.getDisplayValue('priority') || '',
      state: record.getValue('state') || '',
      state_label: record.getDisplayValue('state') || '',
      sprint: record.getValue('sprint') || ''
    };
  }

  function getBacklogStories(groupId) {
    var stories = [];
    var gr = new GlideRecordSecure('rm_story');
    gr.addQuery('assignment_group', groupId);
    gr.addQuery('active', 'true');
    gr.addNullQuery('sprint');
    gr.orderBy('sys_created_on');
    gr.setLimit(100);
    gr.query();

    while (gr.next()) {
      stories.push(formatStory(gr));
    }
    return stories;
  }

  function getSprintStories(groupId, sprintId) {
    var stories = [];
    var gr = new GlideRecordSecure('rm_story');
    gr.addQuery('assignment_group', groupId);
    gr.addQuery('sprint', sprintId);
    gr.orderBy('sys_created_on');
    gr.setLimit(100);
    gr.query();

    while (gr.next()) {
      stories.push(formatStory(gr));
    }
    return stories;
  }

  function getFilterOptions(groupId) {
    var assignees = [];
    var epics = [];
    var assigneesMap = {};
    var epicsMap = {};

    var membership = new GlideRecordSecure('sys_user_grmember');
    membership.addQuery('group', groupId);
    membership.addQuery('user.active', 'true');
    membership.query();
    while (membership.next()) {
      var uId = membership.getValue('user');
      var uName = membership.getDisplayValue('user');
      if (uId && uName && !assigneesMap[uId]) {
        assigneesMap[uId] = true;
        assignees.push({id: uId, name: uName});
      }
    }

    // Get epics from rm_epic table where task type is epic
    var epicGr = new GlideRecordSecure('rm_epic');
    epicGr.addQuery('sys_class_name', 'rm_epic');
    epicGr.orderBy('short_description');
    epicGr.setLimit(100);
    epicGr.query();
    while (epicGr.next()) {
      var eId = epicGr.getUniqueValue();
      var eName = epicGr.getDisplayValue('short_description') || epicGr.getValue('short_description') || epicGr.getValue('number') || '';
      if (eId && eName && !epicsMap[eId]) {
        epicsMap[eId] = true;
        epics.push({id: eId, name: eName});
      }
    }

    assignees.sort(function(a, b) { return a.name.localeCompare(b.name); });
    epics.sort(function(a, b) { return a.name.localeCompare(b.name); });

    return {assignees: assignees, epics: epics};
  }

  function moveStory(storyId, targetSprint, groupId) {
    if (!storyId || !/^[0-9a-f]{32}$/i.test(String(storyId))) {
      throw new Error(gs.getMessage('Select a valid story.'));
    }
    var story = new GlideRecordSecure('rm_story');
    if (!story.get(String(storyId)) || !story.canWrite()) {
      throw new Error(gs.getMessage('Story not found or you do not have permission to update it.'));
    }
    if (story.getValue('assignment_group') !== groupId) {
      throw new Error(gs.getMessage('Story does not belong to this Agile Team group.'));
    }
    var sprintVal = targetSprint && /^[0-9a-f]{32}$/i.test(String(targetSprint)) ? String(targetSprint) : '';
    story.setValue('sprint', sprintVal);
    if (!story.update()) {
      throw new Error(gs.getMessage('Story could not be updated.'));
    }
  }

  function assignStory(storyId, assignedTo, groupId) {
    if (!storyId || !/^[0-9a-f]{32}$/i.test(String(storyId))) {
      throw new Error(gs.getMessage('Select a valid story.'));
    }
    var story = new GlideRecordSecure('rm_story');
    if (!story.get(String(storyId)) || !story.canWrite()) {
      throw new Error(gs.getMessage('Story not found or you do not have permission to update it.'));
    }
    if (story.getValue('assignment_group') !== groupId) {
      throw new Error(gs.getMessage('Story does not belong to this Agile Team group.'));
    }
    var assigneeVal = assignedTo && /^[0-9a-f]{32}$/i.test(String(assignedTo)) ? String(assignedTo) : '';
    story.setValue('assigned_to', assigneeVal);
    if (!story.update()) {
      throw new Error(gs.getMessage('Story assignee could not be updated.'));
    }
  }

  function updateStory(storyId, field, value, groupId) {
    if (!storyId || !/^[0-9a-f]{32}$/i.test(String(storyId))) {
      throw new Error(gs.getMessage('Select a valid story.'));
    }
    var story = new GlideRecordSecure('rm_story');
    if (!story.get(String(storyId)) || !story.canWrite()) {
      throw new Error(gs.getMessage('Story not found or you do not have permission to update it.'));
    }
    if (story.getValue('assignment_group') !== groupId) {
      throw new Error(gs.getMessage('Story does not belong to this Agile Team group.'));
    }
    var allowedFields = {
      'short_description': true,
      'description': true,
      'story_points': true,
      'assigned_to': true,
      'epic': true,
      'priority': true,
      'state': true
    };
    if (!allowedFields[field]) {
      throw new Error(gs.getMessage('Field is not editable.'));
    }
    var val = value !== null && value !== undefined ? String(value) : '';
    if (field === 'short_description') {
      val = val.trim();
      if (!val) throw new Error(gs.getMessage('Short description cannot be empty.'));
    }
    if (field === 'story_points') {
      var num = Number(val);
      if (val !== '' && (!isFinite(num) || num < 0)) {
        throw new Error(gs.getMessage('Story points must be a non-negative number.'));
      }
      val = val !== '' ? String(num) : '0';
    }
    story.setValue(field, val);
    if (!story.update()) {
      throw new Error(gs.getMessage('Story could not be updated.'));
    }
  }

  function createStory(params, groupId, currentSprintId) {
    var shortDesc = params && params.short_description ? String(params.short_description).trim() : '';
    if (!shortDesc) throw new Error(gs.getMessage('Please enter a short description.'));

    var story = new GlideRecordSecure('rm_story');
    story.initialize();
    story.setValue('short_description', shortDesc);
    story.setValue('assignment_group', groupId);

    var desc = params && params.description ? String(params.description).trim() : '';
    if (desc) {
      story.setValue('description', desc);
    }

    var points = Number(params && params.story_points);
    if (isFinite(points) && points >= 0) {
      story.setValue('story_points', String(points));
    }

    if (params && params.target === 'sprint') {
      story.setValue('sprint', currentSprintId);
    } else {
      story.setValue('sprint', '');
    }

    if (params && params.assigned_to && /^[0-9a-f]{32}$/i.test(String(params.assigned_to))) {
      story.setValue('assigned_to', String(params.assigned_to));
    }
    if (params && params.epic && /^[0-9a-f]{32}$/i.test(String(params.epic))) {
      story.setValue('epic', String(params.epic));
    }
    if (params && params.priority) {
      story.setValue('priority', String(params.priority));
    }

    var insertedId = story.insert();
    if (!insertedId) throw new Error(gs.getMessage('Could not create story.'));
    return insertedId;
  }
}
