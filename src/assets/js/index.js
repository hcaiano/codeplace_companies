var index = function() {

  var SERVER_PATH = 'http://codeplace-author-tool.herokuapp.com';
  var SIMILAR_WEB_PATH = 'https://widget.similarweb.com/traffic/';

  // when user submits form on landing
  $('#blogFormLanding').submit(function(event) {
    event.preventDefault();
    var blogUrl = $('#blogFormLanding .input-group-field').val();
    window.location.href = window.location.origin + '/results?blog=' + blogUrl;
  });

  $('#js-slide-to-form').click(function() {
    $("html, body").animate({ scrollTop: $('#js-page-top').offset().top });
  })

}
