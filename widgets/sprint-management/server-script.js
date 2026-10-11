const AGILE_TEAM_TYPE_ID = '1bff3b1493030200ea933007f67ffb6d';
const MAX_SPRINTS = 100;

export default function server(data, _options, input) {
  data.groups = [];
  data.sprints = [];
  data.hasMore = false;

  try {
    var groups = getMemberAgileGroups();
    var groupIds = Object.keys(groups);
    var action = (input && input.action) || 'list';

    if (action === 'list') {
      data.groups = groupList(groups);
      data.sprints = listSprints(groupIds);
      return;
    }

    if (action === 'defaults') {
      var groupId = String(input && input.groupId || '');
      if (!groups[groupId]) fail(gs.getMessage('Select an Agile Team group you belong to.'));
      data.defaults = sprintDefaults(groupId);
      data.groups = groupList(groups);
      data.sprints = listSprints(groupIds);
      return;
    }

    if (action === 'create') {
      createSprints(input && input.sprints, groups);
      data.groups = groupList(groups);
      data.sprints = listSprints(groupIds);
      return;
    }

    if (action === 'start' || action === 'complete') {
      updateSprintState(input && input.sysId, action, groups);
      data.groups = groupList(groups);
      data.sprints = listSprints(groupIds);
      return;
    }

    if (action === 'update_capacity') {
      updateSprintCapacity(input && input.sysId, input && input.teamPoints, groups);
      data.groups = groupList(groups);
      data.sprints = listSprints(groupIds);
      return;
    }

    if (action === 'get_group_members') {
      var sprint = new GlideRecordSecure('rm_sprint');
      if (!sprint.get(input && input.sysId)) fail(gs.getMessage('Sprint not found.'));
      var sprintGroupId = sprint.getValue('assignment_group');
      if (!sprintGroupId || !groups[sprintGroupId]) fail(gs.getMessage('Select an Agile Team group you belong to.'));
      data.members = getGroupMembers(sprintGroupId);
      return;
    }

    fail('Unsupported sprint action.');
  } catch (error) {
    data.isError = true;
    data.errorMessage = error && error.message ? error.message : gs.getMessage('Sprint request failed.');
    if (groups) {
      data.groups = groupList(groups);
      data.sprints = listSprints(Object.keys(groups));
    }
  }

  function fail(message) {
    throw new Error(message);
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

    var result = {};
    var groupId;
    for (groupId in memberIds) {
      if (!Object.prototype.hasOwnProperty.call(memberIds, groupId)) continue;
      var group = new GlideRecordSecure('sys_user_group');
      if (!group.get(groupId) || !group.canRead()) continue;
      if (group.getValue('active') !== '1' && group.getValue('active') !== 'true') continue;
      var types = ',' + (group.getValue('type') || '') + ',';
      if (types.indexOf(',' + AGILE_TEAM_TYPE_ID + ',') === -1) continue;
      result[groupId] = {
        sys_id: groupId,
        name: group.getDisplayValue('name') || group.getValue('name') || ''
      };
    }
    return result;
  }

  function groupList(groupMap) {
    var result = [];
    var id;
    for (id in groupMap) {
      if (Object.prototype.hasOwnProperty.call(groupMap, id)) result.push(groupMap[id]);
    }
    result.sort(function (a, b) { return a.name.localeCompare(b.name); });
    return result;
  }

  function listSprints(groupIds) {
    if (!groupIds.length) return [];

    var gr = new GlideRecordSecure('rm_sprint');
    gr.addQuery('assignment_group', 'IN', groupIds.join(','));
    gr.orderByDesc('start_date');
    gr.setLimit(MAX_SPRINTS + 1);
    gr.query();

    var result = [];
    while (gr.next()) {
      if (result.length >= MAX_SPRINTS) {
        data.hasMore = true;
        break;
      }
      if (!gr.canRead()) continue;
      var groupId = gr.getValue('assignment_group');
      if (!groupMapHas(groupId)) continue;
      result.push({
        sys_id: gr.getUniqueValue(),
        name: gr.getValue('short_description') || gs.getMessage('Untitled sprint'),
        assignment_group: groupId,
        group_name: gr.getDisplayValue('assignment_group'),
        state: gr.getValue('state') || '-6',
        state_label: gr.getDisplayValue('state') || gs.getMessage('Draft'),
        start_date: localDateTime(gr.getValue('start_date')),
        end_date: localDateTime(gr.getValue('end_date')),
        committed_points: gr.getValue('committed_points') || '0',
        actual_points: gr.getValue('actual_points') || '0',
        team_points: gr.getValue('team_points') || '0',
        story_points: gr.getValue('story_points') || '0'
      });
    }
    return result;
  }

  function sprintDefaults(groupId) {
    var result = {name: '', number: '', start_date: currentLocalDateTime()};
    var gr = new GlideRecordSecure('rm_sprint');
    gr.addQuery('assignment_group', groupId);
    gr.orderByDesc('end_date');
    gr.setLimit(500);
    gr.query();
    var maxNumber = 0;
    var latestEnd = '';
    var latestName = '';
    var foundSprint = false;
    while (gr.next()) {
      if (!gr.canRead()) continue;
      var shortDescription = String(gr.getValue('short_description') || '').replace(/^\s+|\s+$/g, '');
      var match = /^(.*?)(?:\s+(\d+))?$/.exec(shortDescription);
      var number = match && match[2] ? parseInt(match[2], 10) : 0;
      if (number > maxNumber) maxNumber = number;
      if (!foundSprint) {
        latestName = shortDescription;
        foundSprint = true;
      }
      if (!latestEnd) latestEnd = gr.getValue('end_date') || '';
    }
    if (foundSprint) {
      var latestMatch = /^(.*?)(?:\s+\d+)?$/.exec(latestName);
      result.name = latestMatch ? latestMatch[1] : latestName;
      result.number = String(maxNumber ? maxNumber + 1 : 1);
    }
    if (latestEnd) {
      var nextStart = new GlideDateTime(latestEnd);
      nextStart.addSeconds(1);
      result.start_date = nextStart.getDisplayValueInternal();
    }
    return result;
  }

  function currentLocalDateTime() {
    return new GlideDateTime().getDisplayValueInternal();
  }

  function localDateTime(value) {
    if (!value) return '';
    return new GlideDateTime(value).getDisplayValueInternal();
  }

  function groupMapHas(id) {
    return !!(id && groups[id]);
  }

  function createSprints(sprints, groupMap) {
    if (!sprints || !sprints.length || sprints.length > MAX_SPRINTS) {
      fail(gs.getMessage('Enter between 1 and {0} sprints.', [MAX_SPRINTS]));
    }

    var prepared = [];
    for (var i = 0; i < sprints.length; i++) {
      var sprint = sprints[i] || {};
      var name = String(sprint.name || '').replace(/^\s+|\s+$/g, '');
      var groupId = String(sprint.assignment_group || '');
      var startDate = String(sprint.start_date || '').replace('T', ' ');
      var endDate = String(sprint.end_date || '').replace('T', ' ');
      if (!name || name.length > 160) fail(gs.getMessage('Each sprint needs a name of 1 to 160 characters.'));
      if (!groupMap[groupId]) fail(gs.getMessage('You can only create sprints for an Agile Team group you belong to.'));
      if (!isDateTime(startDate) || !isDateTime(endDate) || endDate < startDate) {
        fail(gs.getMessage('Enter valid sprint dates. The end date must be on or after the start date.'));
      }
      prepared.push({name: name, assignment_group: groupId, start_date: startDate, end_date: endDate});
    }

    var created = 0;
    data.createdCount = created;
    for (var j = 0; j < prepared.length; j++) {
      var record = new GlideRecordSecure('rm_sprint');
      if (!record.canCreate()) fail(gs.getMessage('You do not have permission to create sprints.'));
      record.initialize();
      record.setValue('short_description', prepared[j].name);
      record.setValue('assignment_group', prepared[j].assignment_group);
      record.setValue('state', '-6');
      record.setValue('start_date', dateTime(prepared[j].start_date));
      record.setValue('end_date', dateTime(prepared[j].end_date));
      if (record.isValidField('committed_points')) record.setValue('committed_points', '0');
      if (record.isValidField('actual_points')) record.setValue('actual_points', '0');
      if (!record.insert()) fail(gs.getMessage('A sprint could not be created. No further sprints were added.'));
      created++;
      data.createdCount = created;
    }
  }

  function updateSprintState(sysId, action, groupMap) {
    if (!sysId || !/^[0-9a-f]{32}$/i.test(String(sysId))) fail(gs.getMessage('Select a valid sprint.'));
    var sprint = new GlideRecordSecure('rm_sprint');
    if (!sprint.get(String(sysId)) || !sprint.canRead() || !sprint.canWrite()) {
      fail(gs.getMessage('Sprint not found or you do not have permission to update it.'));
    }

    var groupId = sprint.getValue('assignment_group');
    if (!groupMap[groupId]) fail(gs.getMessage('You can only manage sprints for an Agile Team group you belong to.'));

    var state = sprint.getValue('state');
    if (action === 'start') {
      if (state !== '-6' && state !== '1') fail(gs.getMessage('Only Draft or Planning sprints can be started.'));
      var current = new GlideRecordSecure('rm_sprint');
      current.addQuery('assignment_group', groupId);
      current.addQuery('state', '2');
      current.addQuery('sys_id', '!=', String(sysId));
      current.setLimit(1);
      current.query();
      if (current.next()) fail(gs.getMessage('This group already has a current sprint. Complete it before starting another.'));
      sprint.setValue('state', '2');
    } else {
      if (state !== '2') fail(gs.getMessage('Only a Current sprint can be completed.'));
      sprint.setValue('state', '3');
    }

    if (!sprint.update()) fail(gs.getMessage('Sprint status could not be updated.'));
  }

  function updateSprintCapacity(sysId, value, groupMap) {
    if (!sysId || !/^[0-9a-f]{32}$/i.test(String(sysId))) fail(gs.getMessage('Select a valid sprint.'));
    var points = Number(value);
    if (value === null || value === undefined || String(value).replace(/^\s+|\s+$/g, '') === '' || !isFinite(points) || points < 0) {
      fail(gs.getMessage('Enter a valid non-negative group capacity.'));
    }

    var sprint = new GlideRecordSecure('rm_sprint');
    if (!sprint.get(String(sysId)) || !sprint.canRead() || !sprint.canWrite()) {
      fail(gs.getMessage('Sprint not found or you do not have permission to update it.'));
    }
    var groupId = sprint.getValue('assignment_group');
    if (!groupMap[groupId]) fail(gs.getMessage('You can only manage sprints for an Agile Team group you belong to.'));
    if (sprint.getValue('state') !== '-6') fail(gs.getMessage('Group capacity points can only be changed while the sprint is Draft.'));
    if (!sprint.isValidField('team_points') || !sprint.getElement('team_points').canWrite()) {
      fail(gs.getMessage('You do not have permission to update group capacity points.'));
    }

    sprint.setValue('team_points', String(points));
    if (!sprint.update()) fail(gs.getMessage('Group capacity points could not be updated.'));
  }

  function getGroupMembers(groupId) {
    var members = [];
    var membership = new GlideRecordSecure('sys_user_grmember');
    membership.addQuery('group', groupId);
    membership.addQuery('user.active', 'true');
    membership.orderBy('user.name');
    membership.query();

    while (membership.next()) {
      var points = '';
      if (membership.isValidField('points')) {
        var el = membership.getElement('points');
        if (el && el.canRead()) points = membership.getValue('points') || '';
      }
      members.push({
        sys_id: membership.getUniqueValue(),
        user_id: membership.getValue('user'),
        user_name: membership.getDisplayValue('user') || '',
        average_points: points || '0'
      });
    }
    return members;
  }

  function dateTime(localDateTime) {
    var value = new GlideDateTime();
    value.setDisplayValueInternal(localDateTime);
    return value.getValue();
  }

  function isDateTime(value) {
    if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return false;
    var parts = value.substring(0, 10).split('-');
    var time = value.substring(11).split(':');
    var date = new Date(Date.UTC(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)));
    return date.getUTCFullYear() === parseInt(parts[0], 10) &&
      date.getUTCMonth() === parseInt(parts[1], 10) - 1 &&
      date.getUTCDate() === parseInt(parts[2], 10) &&
      parseInt(time[0], 10) <= 23 && parseInt(time[1], 10) <= 59 && parseInt(time[2], 10) <= 59;
  }
}
