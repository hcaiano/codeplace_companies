var results = function() {

  var reportUrl, uuid, originalUrl, blogDomain, adValue, codeplaceValue, foundScript;

  var slider = new Foundation.Slider($(".slider"));

  var SERVER_PATH = 'http://codeplace-author-tool.herokuapp.com';
  var SIMILAR_WEB_PATH = 'https://widget.similarweb.com/traffic/';

  // header height on page load
  $('#js-header-blog').css('height', '100vh').css('height', '-=65px');

  // if there's a "blog" param
  var $blogInput = $('#blogForm').find('.input-group-field');
  var blogParam = getUrlParameter("blog");
  if (blogParam != null) {
    blogParam = decodeURIComponent(blogParam);
    if ($blogInput.val() == "") {
      $blogInput.val(blogParam);
    } else {
      $blogInput.val("http://");
    }

    // checks if search is already in local storage
    var blogParamWithoutProtocol = removeProtocolAndPortFromUrl(blogParam);
    var localStorageUuid = blogExistsInLocalStorage(blogParamWithoutProtocol);
    if (localStorageUuid != undefined) {
      getInitialBlogData(localStorageUuid);
    } else {
      submitForm(blogParam);
    }
  } else {
    $blogInput.val("http://");
  }

  // checks if user came from GA
  var cameFromGA = false;
  cameFromGA = getUrlParameter("from_ga");
  if (cameFromGA) {
    var uuidParam = getUrlParameter("uuid");
    getInitialBlogData(uuidParam);
  }

  // populates with previous data
  function getInitialBlogData(uuidParam) {
    $('#progress-icon').show();
    var url = SERVER_PATH + '/results/' + uuidParam;
    $.get(url, setData);
  }

  // when user enters blog url
  $('#blogForm').submit(function(event) {
    event.preventDefault();
    var blogUrl = $('#blogForm :input').val();
    submitForm(blogUrl);
  });

  function submitForm(blogUrl) {
    $('#progress-icon').show();
    var localStorageUuid = blogExistsInLocalStorage(blogUrl);
    if (localStorageUuid != undefined) {
      getInitialBlogData(localStorageUuid);
    } else {
      var url = SERVER_PATH + '/results';
      $.post(url, { "blog[url]": blogUrl }, setData);
    }
  }

  function setData(data) {

    $('#js-no-data-alert').hide();

    reportUrl = data.report_url;
    uuid = data.blog.report_uuid;
    originalUrl = data.blog.original_url;
    blogDomain = data.blog.domain_url;

    // removes all params and adds uuid param
    window.history.pushState("", document.title, window.location.origin + window.location.pathname + '?blog=' + originalUrl);
    adValue = data.values.advertising;
    codeplaceValue = data.values.codeplace;

    var blogData = data.blog;
    var postsData = data.posts;

    // saves uuid in local storage if browser has storage support
    if (typeof(Storage) != undefined) {
      localStorage.setItem(removeProtocolAndPortFromUrl(originalUrl), uuid);
    }

    $blogInput = $('#blogForm').find('.input-group-field');
    if ($blogInput.val() == "") {
      $blogInput.val(originalUrl);
    }

    displaySimilarWebWidget(blogDomain);
    foundScript = false;
    getSimilarWebData(blogDomain);
    displayEngagementData(blogData);
    displayTopPosts(postsData);
    displayGASection(data);
    $('#progress-icon').hide();
    $('#js-content-div').show();
    $('#js-header-blog').animate({ height: '270px' }, 800, 'linear', scrollToResults);
  }

  function scrollToResults() {
    if (!cameFromGA && foundScript) {
      $("html, body").animate({ scrollTop: $('#js-results-section').offset().top }, 500, 'linear');
    } else if (!foundScript) {
      console.log("no script!");
      $('#js-no-data-alert').show().children().show();
      $('#js-posts-section').addClass('no-data');
      $("html, body").animate({ scrollTop: $('#js-no-data-alert').offset().top }, 500, 'linear');
    }
  }

  function displaySimilarWebWidget(blogDomain) {
    var url = SIMILAR_WEB_PATH + blogDomain;
    $('#js-smw-results').attr('src', url);
    $('#js-smw-results').css('visibility', 'visible');
  }

  function getSimilarWebData(blogDomain) {
    var url = 'http://whateverorigin.org/get?url=' + encodeURIComponent(SIMILAR_WEB_PATH + blogDomain) + '&callback=?';
    $.getJSON(url, function(data) {
      data = data.contents;
      var smwDoc = document.implementation.createHTMLDocument("similarWebData");
      smwDoc.documentElement.innerHTML = data;

      // finds all scripts
      var smwScriptArray = smwDoc.getElementsByTagName('script');

      // validates if script contains data object
      var containsDataObjectExp = new RegExp(/"data"[ :]+((?=\[)\[[^]]*\]|(?=\{)\{[^\}]*\}|\"[^"]*\")/gm);

      var smwBlogVisitsDataObject;
      var blogViewsAverage = 0;

      for (var i = 0; i < smwScriptArray.length; i++) {
        var scriptText = smwScriptArray[i].textContent || smwScriptArray[i].innerText; // => gets script text
        var matches = scriptText.match(containsDataObjectExp);

        // if the script text matches the regex expression
        if (scriptText.indexOf("TrafficWidget") != -1 && matches != null && matches.length > 0) {
          // hides no data alert bar
          console.log("encontrou!");
          foundScript = true;

          var match = matches[0];
          smwBlogVisitsDataObject = JSON.parse('{' + match + '}');
          var smwBlogVisitsData = smwBlogVisitsDataObject.data;

          // pushes visitor data to array
          if (smwBlogVisitsData != null) {
            var blogMonthlyViews = [];
            for (var month in smwBlogVisitsData) {
              blogMonthlyViews.push(smwBlogVisitsData[month]);
            }

            //calculates average of last 3 months
            var blogViewsSum = 0;
            if (blogMonthlyViews.length > 0) {
              for (var v = 3; v < 6; v++) {
                if (blogMonthlyViews[v] != 0) {
                  blogViewsSum += blogMonthlyViews[v];
                } else {
                  blogViewsSum += blogMonthlyViews[v - 1];
                }
              }
              blogViewsAverage = blogViewsSum / 3;
            }
          }
        }
      }
      displayAudience(blogViewsAverage);
      displaySlider(blogViewsAverage);
      updateEstimates(blogViewsAverage);
      saveViewsAverage(blogViewsAverage);
    })
  }

  function displayAudience(blogViewsAverage) {
    var $audienceLabel = $('#js-smw-audience-value');
    if (blogViewsAverage >= 1000000) {
      var blogViewsMAverage = blogViewsAverage / 1000000;
      counterToNumber($audienceLabel, 0, blogViewsMAverage, "m", true);
    } else if (blogViewsAverage >= 1000) {
      var blogViewsKAverage = blogViewsAverage / 1000;
      counterToNumber($audienceLabel, 0, blogViewsKAverage, "k", true);
    } else {
      counterToNumber($audienceLabel, 0, blogViewsAverage, "", true);
    }
  }

  function displaySlider(blogViewsAverage) {

    // adds blog url label above slider
    $('#js-url-blog').text(originalUrl);

    // adds views average label above slider
    $sliderLabel = $('#js-views');
    if (blogViewsAverage >= 1000000) {
      var blogViewsMAverage = blogViewsAverage / 1000000;
      counterToNumber($sliderLabel, 0, blogViewsMAverage, "m page views", true);
    } else if (blogViewsAverage >= 1000) {
      var blogViewsKAverage = blogViewsAverage / 1000;
      counterToNumber($sliderLabel, 0, blogViewsKAverage, "k page views", true);
    } else {
      counterToNumber($sliderLabel, 0, blogViewsAverage, " page views", true);
    }

    // adds values label
    $('#js-ad-value-label').text("$" + adValue + " PER VISIT");
    $('#js-cp-value-label').text("$" + codeplaceValue + " PER VISIT");

    // sets slider initial and max values
    if (blogViewsAverage > 1000) {
      slider = new Foundation.Slider($(".slider"), { initialStart: blogViewsAverage, end: blogViewsAverage * 3 });
      $('.slider').off('moved.zf.slider');
    } else {
      slider = new Foundation.Slider($(".slider"), { initialStart: blogViewsAverage, end: 1000 });
      $('.slider').off('moved.zf.slider');
    }

    // when slider value changes
    $('.slider').on('moved.zf.slider', function() {

      var newViewsVal = slider.$input.val();

      // update label
      if (newViewsVal >= 1000) {
        var newViewsKVal = newViewsVal / 1000;
        $('#js-views').text(parseFloat(Math.round(newViewsKVal * 100) / 100).toFixed(1) + "k page views");
      } else {
        $('#js-views').text(parseInt(Math.round(newViewsVal)) + " page views");
      }

      // update estimates
      updateEstimates(newViewsVal);

    });
  }

  function updateEstimates(blogViewsAverage) {

    // calculates and displays ad estimate
    var adCalculation = blogViewsAverage * adValue;
    if (adCalculation >= 1000000) {
      var adMCalculation = adCalculation / 1000000;
      $('#js-advertising-value').text("$" + parseFloat(Math.round(adMCalculation * 100) / 100).toFixed(1) + "m");
    } else if (adCalculation >= 1000) {
      var adKCalculation = adCalculation / 1000;
      $('#js-advertising-value').text("$" + parseFloat(Math.round(adKCalculation * 100) / 100).toFixed(1) + "k");
    } else if (adCalculation < 10) {
      $('#js-advertising-value').text("$" + parseFloat(Math.round(adCalculation * 100) / 100).toFixed(1));
    } else {
      $('#js-advertising-value').text("$" + parseInt(Math.floor(adCalculation)));
    }

    // calculates and displays codeplace estimate
    var cpCalculation = blogViewsAverage * codeplaceValue;
    if (cpCalculation >= 1000000) {
      var cpMCalculation = cpCalculation / 1000000;
      $('#js-codeplace-value').text("$" + parseFloat(Math.round(cpMCalculation * 100) / 100).toFixed(1) + "m");
    } else if (cpCalculation >= 1000) {
      var cpKCalculation = cpCalculation / 1000;
      $('#js-codeplace-value').text("$" + parseFloat(Math.round(cpKCalculation * 100) / 100).toFixed(1) + "k");
    } else if (adCalculation < 10) {
      $('#js-codeplace-value').text("$" + parseFloat(Math.round(cpCalculation * 100) / 100).toFixed(1));
    } else {
      $('#js-codeplace-value').text("$" + parseInt(Math.floor(cpCalculation)));
    }
  }

  function saveViewsAverage(blogViewsAverage) {
    $.ajax({
      url: SERVER_PATH + reportUrl,
      data: { "report[average_visits_last_three_months]": blogViewsAverage },
      type: 'PUT'
    });
  }

  function displayEngagementData(blogData) {

    /* average */

    var averageSharesMonth = parseFloat(blogData.average_shares_per_month).toFixed(1);
    var $engagementLabel = $('#js-engagement-value');
    if (averageSharesMonth == 0) {
      $engagementLabel.text("0");
    } else if (averageSharesMonth >= 1000) {
      var averageKSharesMonth = averageSharesMonth / 1000;
      counterToNumber($engagementLabel, 0, averageKSharesMonth, "k", false);
    } else {
      counterToNumber($engagementLabel, 0, averageSharesMonth, "", false);
    }

    /* facebook */

    var facebookShares = blogData.shares_by_percentage.facebook_shares;

    // bar
    var fbPercentage = 0;
    if (facebookShares > 0) {
      fbPercentage = facebookShares + "%";
    }
    $('.social-facebook').find(".progress-meter").animate({ width: fbPercentage });

    // label
    var $fbLabel = $('.social-facebook').find(".progress-meter-text");
    if (facebookShares > 3) {
      counterToNumber($fbLabel, 0, facebookShares, "%", true);
    } else {
      $fbLabel.text("");
    }

    /* linkedin */

    var linkedinShares = blogData.shares_by_percentage.linkedin_shares;

    // bar
    var liPercentage = 0;
    if (linkedinShares > 0) {
      liPercentage = linkedinShares + "%";
    }
    $('.social-linkedin').find(".progress-meter").animate({ width: liPercentage });

    // label
    var $liLabel = $('.social-linkedin').find(".progress-meter-text");
    if (linkedinShares > 3) {
      counterToNumber($liLabel, 0, linkedinShares, "%", true);
    } else {
      $liLabel.text("");
    }

    /* twitter */

    var twitterShares = blogData.shares_by_percentage.twitter_shares;

    // bar
    var twPercentage = 0;
    if (twitterShares > 0) {
      twPercentage = twitterShares + "%";
    }
    $('.social-twitter').find(".progress-meter").animate({ width: twPercentage });

    // label
    var $twLabel = $('.social-twitter').find(".progress-meter-text");
    if (twitterShares > 3) {
      counterToNumber($twLabel, 0, twitterShares, "%", true);
    } else {
      $twLabel.text("");
    }

    /* googleplus */

    var googlePlusShares = blogData.shares_by_percentage.googleplus_shares;

    // bar
    var gpPercentage = 0;
    if (googlePlusShares > 0) {
      gpPercentage = googlePlusShares + "%";
    }
    $('.social-google').find(".progress-meter").animate({ width: gpPercentage });

    // label
    var $gpLabel = $('.social-google').find(".progress-meter-text");
    if (googlePlusShares > 3) {
      counterToNumber($gpLabel, 0, googlePlusShares, "%", true);
    } else {
      $gpLabel.text("");
    }

    /* pinterest */

    var pinterestShares = blogData.shares_by_percentage.pinterest_shares;

    // bar
    var ptPercentage = 0;
    if (pinterestShares > 0) {
      ptPercentage = pinterestShares + "%";
    }
    $('.social-pinterest').find(".progress-meter").animate({ width: ptPercentage });

    // label
    var $ptLabel = $('.social-pinterest').find(".progress-meter-text");
    if (pinterestShares > 3) {
      counterToNumber($ptLabel, 0, pinterestShares, "%", true);
    } else {
      $ptLabel.text("");
    }
  }

  function displayTopPosts(posts) {
    if (posts.length > 0) {
      $('#js-posts-section').show();
      var postCount = 1;
      for (var post in posts) {
        var currentPost = posts[post];
        var $postId = $("#post" + postCount);
        $postId.find(".post-url").attr("href", currentPost.url);
        $postId.find(".post-title").text(currentPost.title);
        $postId.find(".post-author-name").text(currentPost.author_name);
        $postId.find(".post-published-at").text(currentPost.published_at);
        $postId.find(".post-fb-shares").text(currentPost.facebook_shares);
        $postId.find(".post-tw-shares").text(currentPost.twitter_shares);
        $postId.find(".post-li-shares").text(currentPost.linkedin_shares);
        $postId.find(".post-gp-shares").text(currentPost.googleplus_shares);
        $postId.find(".post-tt-shares").text(currentPost.total_shares);
        $postId.show();
        postCount++;
      }
    } else {
      $('#js-posts-section').hide();
    }
  }

  // displays block according to GA status
  function displayGASection(data) {

    var gaErrorMessage = getUrlParameter("error");

    /* if user hasn't connected */
    if (!data.ga_connected) {
      // hide alert + error messages, displays button with link
      $('#js-ga-div-not-connected').show();
      $('#js-ga-link').attr('href', SERVER_PATH + '/oauth2/google?uuid=' + uuid);
      $('#js-ga-div-connected').hide();
      $('#js-ga-div-error').hide();
    }

    /* if user has connected and an error occured */
    else if (gaErrorMessage != null) {
      // hides alert, displays button with link + error
      $('#js-ga-div-not-connected').show();
      $('#js-ga-link').attr('href', SERVER_PATH + '/oauth2/google?uuid=' + uuid);
      $('#js-ga-div-error').show();
      $('#js-error-message').text(gaErrorMessage);
      $('#js-ga-div-connected').hide();
    }

    /* if user has successfully connected (previously) */
    else if (data.ga_connected && !cameFromGA) {
      // hides ga section (filter + button) + error + alert
      $('#js-ga-section').hide();
      $('#js-ga-div-connected').hide();
    }

    /* if user has successfully connected (just now) */
    else if (cameFromGA) {
      // hides ga section (filter + button) + error, displays alert
      $('#js-ga-section').hide();
      $('#js-ga-div-connected').show();
    }

  }

  // when user enters email
  $('#emailForm').submit(function(event) {
    event.preventDefault();
    var email = $('#emailForm :input').val();
    saveEmail(email);
  });

  function saveEmail(email) {
    if (uuid) {
      $.ajax({
        url: SERVER_PATH + '/users/' + uuid,
        data: { "user[email]": email },
        type: 'PUT',
        success: function(result) {
          $('#js-input-email').val("");
          $('#js-email-button').val("SUBMITTED!").addClass('success');
          setTimeout(function() {
            $('#js-email-button').val("GET STARTED!").removeClass('success');
          }, 1500);
        }
      });
    }
    /*
    else {
      $.ajax({
        url: SERVER_PATH + '/emails',
        data: { "user[email]": email },
        type: 'PUT',
        success: function(result) {
        }
      });
    }
    */
  }

  /* helper functions */

  function getUrlParameter(sParam) {
    var sPageURL = decodeURIComponent(window.location.search.substring(1)),
      sURLVariables = sPageURL.split('&'),
      sParameterName,
      i;
    for (i = 0; i < sURLVariables.length; i++) {
      sParameterName = sURLVariables[i].split('=');
      if (sParameterName[0] === sParam) {
        return sParameterName[1] === undefined ? true : sParameterName[1];
      }
    }
  }

  function counterToNumber(label, minNumber, maxNumber, options, round) {
    label.prop('Counter', minNumber).animate({
      Counter: maxNumber
    }, {
      step: function(now) {
        if (round) {
          now = Math.ceil(now);
        } else {
          now = parseFloat(now).toFixed(1);
        }
        if (options) {
          label.text(now + options);
        } else {
          label.text(now);
        }
      }
    });
  }

  function removeProtocolAndPortFromUrl(url) {

    var cleanUrl = url;

    // find & remove protocol (http, ftp, etc.)
    if (url.indexOf("://") > -1) {
      cleanUrl = url.split('://')[1];
    }

    //find & remove port number
    cleanUrl = cleanUrl.split(':')[0];
    return cleanUrl;
  }

  function blogExistsInLocalStorage(blog) {
    for (var b in localStorage) {
      if (b == blog) {
        return localStorage[b];
      }
    }
  }

}
