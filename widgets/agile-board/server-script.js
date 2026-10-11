var AGILE_TEAM_TYPE_ID = '1bff3b1493030200ea933007f67ffb6d';

export default function server(data, options, input) {
  try {
    var action = input && input.action ? input.action : 'board_init';
    var groups = getMemberAgileGroups();
    data.groups = groups;

    var selectedGroupId = (input && input.groupId) || (options && options.groupId) || (groups.length > 0 ? groups[0].sys_id : '');
    data.selectedGroupId = selectedGroupId;

    if (!selectedGroupId) {
      data.sprints = [];
      data.stories = [];
      data.laneChoices = [];
      data.members = [];
      data.epics = [];
      return;
    }

    var groupInfo = getGroupInfo(selectedGroupId);
    data.groupName = groupInfo.name;
    data.groupMembersCount = groupInfo.memberCount;
    data.currentUser = gs.getUserDisplayName();

    var sprints = getGroupSprints(selectedGroupId);
    data.sprints = sprints;

    var selectedSprintId = (input && input.sprintId) || (options && options.sprintId) || getActiveOrClosestSprintId(sprints);
    data.selectedSprintId = selectedSprintId;

    var sprintInfo = getSprintInfo(selectedSprintId);
    data.sprintName = sprintInfo.name || gs.getMessage('Current Sprint');

    var verticalLaneField = (input && input.verticalLaneField) || 'state';
    data.verticalLaneField = verticalLaneField;

    var swimlaneField = (input && input.swimlaneField) || 'none';
    data.swimlaneField = swimlaneField;

    var dueDateField = (input && input.dueDateField) || 'due_date';
    data.dueDateField = dueDateField;

    if (action === 'update_story_lane') {
      updateStoryField(input.storyId, input.field || verticalLaneField, input.value, input.newRank, selectedGroupId, input.swimlaneField, input.toSwimlane);
    } else if (action === 'create_card') {
      createStoryCard(input, selectedGroupId, selectedSprintId, verticalLaneField);
    } else if (action === 'toggle_blocker') {
      toggleStoryBlocker(input.storyId, input.blocked, input.blockedReason, selectedGroupId);
    }

    data.laneChoices = getFieldChoices('rm_story', verticalLaneField);
    data.stories = getSprintStories(selectedGroupId, selectedSprintId, dueDateField);
    data.members = getGroupMembers(selectedGroupId);
    data.assignees = data.members;
    data.epics = getEpics();
    data.priorityChoices = getFieldChoices('rm_story', 'priority');
  } catch (error) {
    data.isError = true;
    data.errorMessage = error && error.message ? error.message : gs.getMessage('Agile board error.');
  }

  function getMemberAgileGroups() {
    var memberships = new GlideRecordSecure('sys_user_grmember');
    memberships.addQuery('user', gs.getUserID());
    memberships.setLimit(500);
    memberships.query();

    var memberIds = {};
    while (memberships.next()) {
      memberIds[memberships.getValue('group')] = true;
    }

    var result = [];
    for (var groupId in memberIds) {
      if (!Object.prototype.hasOwnProperty.call(memberIds, groupId)) continue;
      var group = new GlideRecordSecure('sys_user_group');
      if (!group.get(groupId) || !group.canRead()) continue;
      if (group.getValue('active') !== '1' && group.getValue('active') !== 'true') continue;
      var types = ',' + (group.getValue('type') || '') + ',';
      if (types.indexOf(',' + AGILE_TEAM_TYPE_ID + ',') === -1) continue;
      result.push({
        sys_id: groupId,
        name: group.getDisplayValue('name') || group.getValue('name') || ''
      });
    }
    result.sort(function(a, b) { return a.name.localeCompare(b.name); });
    return result;
  }

  function getGroupInfo(groupId) {
    var name = '';
    var group = new GlideRecordSecure('sys_user_group');
    if (group.get(groupId)) {
      name = group.getDisplayValue('name') || group.getValue('name') || '';
    }

    var mGr = new GlideRecordSecure('sys_user_grmember');
    mGr.addQuery('group', groupId);
    mGr.query();
    var count = mGr.getRowCount();

    return {
      name: name,
      memberCount: count
    };
  }

  function getSprintInfo(sprintId) {
    if (!sprintId) return {name: ''};
    var sprint = new GlideRecordSecure('rm_sprint');
    if (sprint.get(sprintId)) {
      return {
        name: sprint.getDisplayValue('short_description') || sprint.getValue('number') || gs.getMessage('Sprint')
      };
    }
    return {name: ''};
  }

  function getGroupSprints(groupId) {
    var sprints = [];
    var sGr = new GlideRecordSecure('rm_sprint');
    sGr.addQuery('assignment_group', groupId);
    sGr.orderByDesc('start_date');
    sGr.setLimit(30);
    sGr.query();

    while (sGr.next()) {
      sprints.push({
        sys_id: sGr.getUniqueValue(),
        name: sGr.getDisplayValue('short_description') || sGr.getValue('number') || gs.getMessage('Sprint'),
        state: sGr.getValue('state') || '-6',
        state_label: sGr.getDisplayValue('state') || gs.getMessage('Draft'),
        start_date: sGr.getDisplayValue('start_date') || '',
        end_date: sGr.getDisplayValue('end_date') || '',
        start_date_raw: sGr.getValue('start_date') || '',
        end_date_raw: sGr.getValue('end_date') || ''
      });
    }
    return sprints;
  }

  function getActiveOrClosestSprintId(sprints) {
    if (!sprints || sprints.length === 0) return '';
    // 1. Current sprint (state === '2')
    for (var i = 0; i < sprints.length; i++) {
      if (sprints[i].state === '2') return sprints[i].sys_id;
    }

    // 2. Closest sprint to current date/time
    var nowMs = new GlideDateTime().getNumericValue();
    var closestId = sprints[0].sys_id;
    var minDiff = Infinity;

    for (var j = 0; j < sprints.length; j++) {
      var s = sprints[j];
      var rawDate = s.start_date_raw || s.end_date_raw;
      if (rawDate) {
        var gdt = new GlideDateTime(rawDate);
        var diff = Math.abs(gdt.getNumericValue() - nowMs);
        if (diff < minDiff) {
          minDiff = diff;
          closestId = s.sys_id;
        }
      }
    }
    return closestId;
  }

  function getFieldChoices(tableName, element) {
    var choices = [];
    var choiceGr = new GlideRecordSecure('sys_choice');
    choiceGr.addQuery('name', tableName);
    choiceGr.addQuery('element', element);
    choiceGr.addQuery('inactive', 'false');
    choiceGr.orderBy('sequence');
    choiceGr.query();

    if (choiceGr.getRowCount() === 0) {
      choiceGr = new GlideRecordSecure('sys_choice');
      choiceGr.addQuery('name', 'task');
      choiceGr.addQuery('element', element);
      choiceGr.addQuery('inactive', 'false');
      choiceGr.orderBy('sequence');
      choiceGr.query();
    }

    var seen = {};
    while (choiceGr.next()) {
      var v = choiceGr.getValue('value');
      if (!seen[v]) {
        seen[v] = true;
        choices.push({
          value: v,
          label: choiceGr.getValue('label') || v
        });
      }
    }
    return choices;
  }

  function getSprintStories(groupId, sprintId, dueDateField) {
    if (!sprintId) return [];
    var stories = [];
    var gr = new GlideRecordSecure('rm_story');
    gr.addQuery('assignment_group', groupId);
    gr.addQuery('sprint', sprintId);
    gr.orderBy('rank');
    gr.orderBy('sys_created_on');
    gr.setLimit(200);
    gr.query();

    var dateField = dueDateField && gr.isValidField(dueDateField) ? dueDateField : 'due_date';

    while (gr.next()) {
      var epicDisplay = '';
      if (gr.isValidField('epic')) {
        var epicEl = gr.getElement('epic');
        if (epicEl && epicEl.canRead()) {
          epicDisplay = gr.getDisplayValue('epic') || '';
        }
      }

      var dueDateVal = '';
      if (gr.isValidField(dateField)) {
        dueDateVal = gr.getDisplayValue(dateField) || gr.getValue(dateField) || '';
      }

      stories.push({
        sys_id: gr.getUniqueValue(),
        number: gr.getValue('number') || '',
        short_description: gr.getValue('short_description') || '',
        story_points: gr.getValue('story_points') || '0',
        assigned_to: gr.getValue('assigned_to') || '',
        assigned_to_name: gr.getDisplayValue('assigned_to') || '',
        epic: gr.getValue('epic') || '',
        epic_name: epicDisplay,
        priority: gr.getValue('priority') || '3',
        priority_label: gr.getDisplayValue('priority') || '',
        state: gr.getValue('state') || '-6',
        state_label: gr.getDisplayValue('state') || '',
        due_date: dueDateVal,
        blocked: gr.getValue('blocked') === '1' || gr.getValue('blocked') === 'true',
        blocked_reason: gr.getValue('blocked_reason') || '',
        rank: gr.getValue('rank') || ''
      });
    }
    return stories;
  }

  function getGroupMembers(groupId) {
    var members = [];
    var membership = new GlideRecordSecure('sys_user_grmember');
    membership.addQuery('group', groupId);
    membership.addQuery('user.active', 'true');
    membership.query();

    while (membership.next()) {
      var uId = membership.getValue('user');
      var uName = membership.getDisplayValue('user');
      if (uId && uName) {
        var parts = uName.trim().split(' ');
        var initials = parts.length > 1
          ? (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
          : uName.substring(0, 2).toUpperCase();
        members.push({
          id: uId,
          name: uName,
          initials: initials
        });
      }
    }
    members.sort(function(a, b) { return a.name.localeCompare(b.name); });
    return members;
  }

  function getEpics() {
    var epics = [];
    var epicGr = new GlideRecordSecure('rm_epic');
    epicGr.addQuery('sys_class_name', 'rm_epic');
    epicGr.orderBy('short_description');
    epicGr.setLimit(100);
    epicGr.query();

    while (epicGr.next()) {
      epics.push({
        id: epicGr.getUniqueValue(),
        name: epicGr.getDisplayValue('short_description') || epicGr.getValue('short_description') || epicGr.getValue('number') || ''
      });
    }
    return epics;
  }

  function updateStoryField(storyId, field, value, newRank, groupId, swimlaneField, toSwimlane) {
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
    if (field && story.isValidField(field)) {
      story.setValue(field, String(value));
    }
    if (swimlaneField === 'assigned_to' && toSwimlane !== undefined) {
      var assigneeVal = toSwimlane === 'unassigned' ? '' : toSwimlane;
      story.setValue('assigned_to', assigneeVal);
    } else if (swimlaneField === 'epic' && toSwimlane !== undefined) {
      var epicVal = toSwimlane === 'no_epic' ? '' : toSwimlane;
      story.setValue('epic', epicVal);
    } else if (swimlaneField === 'priority' && toSwimlane !== undefined) {
      story.setValue('priority', String(toSwimlane));
    }
    if (newRank) {
      story.setValue('rank', String(newRank));
    }
    if (!story.update()) {
      throw new Error(gs.getMessage('Story status could not be updated.'));
    }
  }

  function createStoryCard(params, groupId, currentSprintId, laneField) {
    var shortDesc = params && params.short_description ? String(params.short_description).trim() : '';
    if (!shortDesc) throw new Error(gs.getMessage('Please enter a short description.'));

    var story = new GlideRecordSecure('rm_story');
    story.initialize();
    story.setValue('short_description', shortDesc);
    story.setValue('assignment_group', groupId);
    if (currentSprintId) {
      story.setValue('sprint', currentSprintId);
    }
    if (params.laneValue) {
      story.setValue(laneField || 'state', String(params.laneValue));
    }
    if (params.assigned_to) {
      story.setValue('assigned_to', String(params.assigned_to));
    }
    if (params.story_points) {
      story.setValue('story_points', String(params.story_points));
    }
    if (!story.insert()) {
      throw new Error(gs.getMessage('Could not create story card.'));
    }
  }

  function toggleStoryBlocker(storyId, blocked, reason, groupId) {
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
    var isBlocked = blocked === true || blocked === 'true' || blocked === '1';
    story.setValue('blocked', isBlocked ? '1' : '0');
    if (reason !== undefined && reason !== null) {
      story.setValue('blocked_reason', String(reason));
    }
    if (!story.update()) {
      throw new Error(gs.getMessage('Blocker status could not be updated.'));
    }
  }
}
