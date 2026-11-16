/* Draws the tile grid on the hub homepage from the list in projects.js. */
(function () {
  'use strict';

  var REQUIRED_FIELDS = ['title', 'description', 'href', 'image', 'kind', 'date'];
  var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var ASTERISK = '✳︎';

  var grid = document.getElementById('grid');
  var count = document.getElementById('count');
  var message = document.getElementById('message');

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function showMessage(text) {
    message.textContent = text;
    message.hidden = false;
  }

  /* Returns what is wrong with an entry, or an empty string when it is complete. */
  function problemWith(project) {
    if (!project || typeof project !== 'object') return 'it is not an object';
    var missing = REQUIRED_FIELDS.filter(function (field) {
      return typeof project[field] !== 'string' || project[field].trim() === '';
    });
    if (missing.length) return 'missing ' + missing.join(', ');
    if (!DATE_PATTERN.test(project.date)) return 'date must look like 2026-11-16';
    return '';
  }

  function monthAndYear(date) {
    var parts = date.split('-');
    return MONTHS[Number(parts[1]) - 1] + ' ' + parts[0];
  }

  function tile(project) {
    var item = el('li');
    var link = el('a', 'tile');
    link.href = project.href;

    var frame = el('div', 'tile-img');
    var image = el('img');
    image.src = project.image;
    image.alt = '';
    image.loading = 'lazy';
    image.addEventListener('error', function () {
      frame.classList.add('is-missing');
    });
    frame.appendChild(image);

    var body = el('div', 'tile-body');
    var label = el('div', 'label');
    label.appendChild(el('b', '', ASTERISK));
    label.appendChild(document.createTextNode(' ' + project.kind + ' · ' + monthAndYear(project.date)));
    body.appendChild(label);
    body.appendChild(el('h3', '', project.title));
    body.appendChild(el('p', '', project.description));

    link.appendChild(frame);
    link.appendChild(body);
    item.appendChild(link);
    return item;
  }

  function render(projects) {
    if (!Array.isArray(projects)) {
      showMessage('The project list did not load. Check projects.js.');
      return;
    }

    var valid = [];
    projects.forEach(function (project, index) {
      var problem = problemWith(project);
      if (problem) {
        console.error('projects.js: entry ' + (index + 1) + ' was skipped, ' + problem + '.');
        return;
      }
      valid.push(project);
    });

    if (!valid.length) {
      showMessage('No projects here yet.');
      return;
    }

    var newestFirst = valid.slice().sort(function (a, b) {
      return b.date.localeCompare(a.date);
    });
    newestFirst.forEach(function (project) {
      grid.appendChild(tile(project));
    });
    count.textContent = newestFirst.length + (newestFirst.length === 1 ? ' project' : ' projects');
  }

  render(window.HUB_PROJECTS);
})();
