(function(){
  "use strict";

  function $(id){ return document.getElementById(id); }

  function fmtDuration(ms){
    if(!ms || ms < 0) return "—";
    var s = Math.round(ms / 1000);
    var h = Math.floor(s / 3600);
    var m = Math.floor((s % 3600) / 60);
    var sec = s % 60;
    if(h > 0) return h + "h " + m + "m";
    if(m > 0) return m + "m" + (sec > 0 ? " " + sec + "s" : "");
    return sec + "s";
  }

  function avg(arr){
    if(!arr.length) return 0;
    return arr.reduce(function(a,b){ return a+b; }, 0) / arr.length;
  }

  function median(arr){
    if(!arr.length) return 0;
    var c = arr.slice().sort(function(a,b){ return a-b; });
    var mid = Math.floor(c.length / 2);
    return c.length % 2 ? c[mid] : (c[mid-1] + c[mid]) / 2;
  }

  function percentile(arr, p){
    if(!arr.length) return 0;
    var c = arr.slice().sort(function(a,b){ return a-b; });
    if(c.length === 1) return c[0];
    var idx = (c.length - 1) * p;
    var lo = Math.floor(idx), hi = Math.ceil(idx);
    if(lo === hi) return c[lo];
    return c[lo] + (c[hi] - c[lo]) * (idx - lo);
  }

  function groupBy(arr, key){
    var out = {};
    arr.forEach(function(item){
      var k = item[key] || "Unknown";
      if(!out[k]) out[k] = [];
      out[k].push(item);
    });
    return out;
  }

  function barChart(title, rows, opts){
    // rows: [{label, ms, count}]
    if(!rows.length) return "";
    opts = opts || {};
    var maxVal = opts.maxMs || Math.max.apply(null, rows.map(function(r){ return r.ms; })) || 1;
    var fillClass = opts.teal ? "statsBarFill teal" : "statsBarFill";
    var html = '<div class="statsChartWrap"><div class="statsChartTitle">' + esc(title) + '</div>';
    rows.forEach(function(r){
      var pct = Math.max(4, Math.round((r.ms / maxVal) * 100));
      html += '<div class="statsBarRow">'
        + '<span class="statsBarLabel" title="' + esc(r.label) + '">' + esc(r.label) + '</span>'
        + '<div class="statsBarTrack">'
        + '<div class="' + fillClass + '" style="width:' + pct + '%"></div>'
        + '</div>'
        + '<span class="statsBarVal">' + esc(opts.format ? opts.format(r) : fmtDuration(r.ms)) + (!opts.hideCount && r.count ? ' <small>(' + r.count + ')</small>' : '') + '</span>'
        + '</div>';
    });
    html += '</div>';
    return html;
  }

  function esc(s){
    return String(s || "").replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  function dayShort(d){
    return (d.getMonth()+1) + "/" + d.getDate();
  }

  function weekdayName(i){
    return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][i] || "—";
  }

  function hourLabel(h){
    h = Number(h) || 0;
    var suffix = h >= 12 ? "pm" : "am";
    var display = h % 12; if(display === 0) display = 12;
    return display + suffix;
  }

  // SVG area + line chart of a daily series. points: [{label, full, value}]
  function trendLineChart(points, opts){
    opts = opts || {};
    if(points.length < 2) return "";
    var w = 760, h = 250, padL = 38, padR = 14, padT = 14, padB = 30;
    var innerW = w - padL - padR, innerH = h - padT - padB;
    var maxVal = Math.max.apply(null, points.map(function(p){ return p.value; }));
    if(maxVal <= 0) maxVal = 1;
    // round axis max to a "nice" number
    var niceMax = maxVal <= 4 ? maxVal : Math.ceil(maxVal / 5) * 5;
    var n = points.length;
    var xAt = function(i){ return padL + (n === 1 ? innerW/2 : (i/(n-1)) * innerW); };
    var yAt = function(v){ return padT + innerH - (v/niceMax) * innerH; };

    var svg = '<svg viewBox="0 0 ' + w + ' ' + h + '" width="100%" preserveAspectRatio="none" role="img" aria-label="Sessions per day">';
    svg += '<defs><linearGradient id="statsTrendGrad" x1="0" y1="0" x2="0" y2="1">'
      + '<stop offset="0%" stop-color="var(--settingsAccent,#7dd3fc)" stop-opacity="0.32"/>'
      + '<stop offset="100%" stop-color="var(--settingsAccent,#7dd3fc)" stop-opacity="0"/>'
      + '</linearGradient></defs>';

    // horizontal gridlines + y labels (0, mid, max)
    [0, 0.5, 1].forEach(function(t){
      var val = Math.round(niceMax * t);
      var y = yAt(val);
      svg += '<line class="statsTrendGrid" x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (w-padR) + '" y2="' + y.toFixed(1) + '"/>';
      svg += '<text class="statsTrendYLabel" x="' + (padL-7) + '" y="' + (y+3.5).toFixed(1) + '" text-anchor="end">' + val + '</text>';
    });

    // build line + area paths
    var line = "", area = "";
    points.forEach(function(p, i){
      var x = xAt(i).toFixed(1), y = yAt(p.value).toFixed(1);
      line += (i === 0 ? "M" : "L") + x + " " + y + " ";
      area += (i === 0 ? "M" : "L") + x + " " + y + " ";
    });
    area += "L" + xAt(n-1).toFixed(1) + " " + yAt(0).toFixed(1) + " L" + xAt(0).toFixed(1) + " " + yAt(0).toFixed(1) + " Z";
    svg += '<path d="' + area + '" fill="url(#statsTrendGrad)"/>';
    svg += '<path class="statsTrendLine" d="' + line + '"/>';

    // x labels: sample so they don't overlap (~7 labels), always include the last
    var step = Math.max(1, Math.round(n / 7));
    var labelIdx = [];
    for(var li = 0; li < n; li += step) labelIdx.push(li);
    if(labelIdx[labelIdx.length-1] !== n-1){
      // drop the last sampled label if it would crowd the final one
      if((n-1) - labelIdx[labelIdx.length-1] < step * 0.6) labelIdx.pop();
      labelIdx.push(n-1);
    }
    labelIdx.forEach(function(i){
      svg += '<text class="statsTrendXLabel" x="' + xAt(i).toFixed(1) + '" y="' + (h-9) + '" text-anchor="middle">' + esc(points[i].label) + '</text>';
    });

    // points with native tooltip
    points.forEach(function(p, i){
      svg += '<circle class="statsTrendDot" cx="' + xAt(i).toFixed(1) + '" cy="' + yAt(p.value).toFixed(1) + '" r="3">'
        + '<title>' + esc(p.full + ": " + p.value + " session" + (p.value === 1 ? "" : "s")) + '</title></circle>';
    });

    svg += '</svg>';
    return '<div class="statsChartWrap statsTrendPanel"><div class="statsChartTitle">' + esc(opts.title || "Sessions per day") + '</div>'
      + '<div class="statsTrendChart">' + svg + '</div></div>';
  }

  function metricCard(label, value, sub){
    return '<article class="statsMetric">'
      + '<strong>' + esc(label) + '</strong>'
      + '<span>' + esc(String(value)) + '</span>'
      + (sub ? '<em>' + esc(sub) + '</em>' : '')
      + '</article>';
  }

  function highlight(label, value){
    return '<div class="statsHighlight"><strong>' + esc(label) + '</strong><span>' + esc(String(value)) + '</span></div>';
  }

  function renderStats(roomSessions, cleanSessions, days){
    // ---- Core metrics ----
    var roomDur = roomSessions.filter(function(s){ return s.duration_ms > 0; }).map(function(s){ return s.duration_ms; });
    var cleanDur = cleanSessions.filter(function(s){ return s.duration_ms > 0; }).map(function(s){ return s.duration_ms; });
    var roomTotalMs = roomDur.reduce(function(a,b){ return a+b; }, 0);
    var uniqueRooms = {};
    roomSessions.forEach(function(s){ if(s.room_name) uniqueRooms[s.room_name] = true; });

    var summaryEl = $("statsSummaryRow");
    if(summaryEl){
      summaryEl.innerHTML =
        metricCard("Visits", roomSessions.length, "Appointments in range")
        + metricCard("Avg room time", fmtDuration(avg(roomDur)), "Mean appointment duration")
        + metricCard("Median room time", fmtDuration(median(roomDur)), "Typical appointment")
        + metricCard("P90 room time", fmtDuration(percentile(roomDur, 0.9)), "Upper-end duration")
        + metricCard("Cleanings", cleanSessions.length, "Closed cleaning sessions")
        + metricCard("Avg clean time", fmtDuration(avg(cleanDur)), "Average turnaround")
        + metricCard("Room hours", (roomTotalMs / 3600000).toFixed(1), "Total appointment hours")
        + metricCard("Rooms used", Object.keys(uniqueRooms).length, "Distinct rooms in range");
      summaryEl.hidden = false;
    }

    // ---- Room bar chart (avg time by room) ----
    var byRoom = groupBy(roomSessions, "room_name");
    var roomRows = Object.keys(byRoom).map(function(name){
      var sessions = byRoom[name];
      var durations = sessions.filter(function(s){ return s.duration_ms; }).map(function(s){ return s.duration_ms; });
      return { label: name, ms: avg(durations), count: sessions.length };
    }).filter(function(r){ return r.ms > 0; });
    roomRows.sort(function(a,b){ return b.ms - a.ms; });

    // ---- Doctor bar chart (avg time by doctor) ----
    var withDoctor = roomSessions.filter(function(s){ return s.doctor_name; });
    var byDoc = groupBy(withDoctor, "doctor_name");
    var docRows = Object.keys(byDoc).map(function(name){
      var sessions = byDoc[name];
      var durations = sessions.filter(function(s){ return s.duration_ms; }).map(function(s){ return s.duration_ms; });
      return { label: name, ms: avg(durations), count: sessions.length };
    }).filter(function(r){ return r.ms > 0; });
    docRows.sort(function(a,b){ return b.ms - a.ms; });

    // ---- Hour-of-day distribution ----
    var hourCounts = new Array(24).fill(0);
    roomSessions.forEach(function(s){ hourCounts[new Date(s.started_at).getHours()]++; });
    var peakHourCount = Math.max.apply(null, hourCounts) || 1;
    var hourRows = [];
    for(var h = 7; h <= 19; h++){
      hourRows.push({ label: hourLabel(h), ms: hourCounts[h], count: hourCounts[h] });
    }

    // ---- Daily trend across the range ----
    var trendDays = Math.min(days, 90);
    var trendMap = {};
    var orderedKeys = [];
    for(var i = trendDays - 1; i >= 0; i--){
      var d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
      var key = d.toDateString();
      orderedKeys.push(key);
      trendMap[key] = {
        label: dayShort(d),
        full: d.toLocaleDateString([], { weekday:"short", month:"short", day:"numeric" }),
        value: 0
      };
    }
    roomSessions.forEach(function(s){
      var key = new Date(s.started_at).toDateString();
      if(trendMap[key]) trendMap[key].value++;
    });
    var trendPoints = orderedKeys.map(function(k){ return trendMap[k]; });

    // ---- Highlights ----
    var weekdayCounts = new Array(7).fill(0);
    roomSessions.forEach(function(s){ weekdayCounts[new Date(s.started_at).getDay()]++; });
    var busiestWeekday = weekdayCounts.indexOf(Math.max.apply(null, weekdayCounts));
    var peakHour = hourCounts.indexOf(peakHourCount);
    var topDoctor = docRows.slice().sort(function(a,b){ return b.count - a.count; })[0];
    var longestRoom = roomRows.length ? roomRows[0] : null;
    var longestSession = roomDur.length ? Math.max.apply(null, roomDur) : 0;
    var busiestDay = trendPoints.slice().sort(function(a,b){ return b.value - a.value; })[0];

    var chartEl = $("statsRoomChart");
    if(chartEl){
      var html = "";

      if(roomSessions.length){
        html += '<div class="statsSection">';
        html += trendLineChart(trendPoints, { title: "Sessions per day (last " + trendDays + " days)" });
        html += '<div class="statsHighlights">'
          + '<div class="statsChartTitle">Highlights</div>'
          + '<div class="statsHighlightGrid">'
          + highlight("Busiest weekday", (weekdayCounts[busiestWeekday] ? weekdayName(busiestWeekday) + " (" + weekdayCounts[busiestWeekday] + ")" : "—"))
          + highlight("Peak start hour", (peakHourCount ? hourLabel(peakHour) + " (" + peakHourCount + ")" : "—"))
          + highlight("Busiest day", (busiestDay && busiestDay.value ? busiestDay.full + " (" + busiestDay.value + ")" : "—"))
          + highlight("Top doctor", (topDoctor ? topDoctor.label + " (" + topDoctor.count + ")" : "—"))
          + highlight("Longest room avg", (longestRoom ? longestRoom.label + " · " + fmtDuration(longestRoom.ms) : "—"))
          + highlight("Longest session", fmtDuration(longestSession))
          + '</div></div>';
        html += '</div>';
      }

      var bars = "";
      if(docRows.length) bars += barChart("Avg room time by doctor", docRows);
      if(roomRows.length) bars += barChart("Avg room time by room", roomRows);
      if(roomSessions.length){
        bars += barChart("Sessions by time of day", hourRows, {
          teal: true,
          hideCount: true,
          maxMs: peakHourCount,
          format: function(r){ return String(r.count); }
        });
      }
      if(bars) html += '<div class="statsBars">' + bars + '</div>';

      chartEl.innerHTML = html;
      chartEl.hidden = false;
    }

    var statusEl = $("statsStatusLine");
    if(statusEl) statusEl.textContent =
      roomSessions.length + " room session" + (roomSessions.length !== 1 ? "s" : "")
      + " and " + cleanSessions.length + " cleaning session" + (cleanSessions.length !== 1 ? "s" : "")
      + " in the last " + days + " days.";
  }

  window.roomboardLoadStats = function(days){
    var practiceId = window.__roomboardPracticeId;
    var sb = window.__roomboardSupabase;
    if(!practiceId || !sb){
      var s = $("statsStatusLine");
      if(s) s.textContent = "Sign in to a clinic to view stats.";
      return;
    }
    days = days || 30;
    var since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
    var statusEl = $("statsStatusLine");
    if(statusEl) statusEl.textContent = "Loading…";
    var btn = $("loadStatsBtn"); if(btn) btn.disabled = true;

    Promise.all([
      sb.from("room_sessions")
        .select("room_name,doctor_name,started_at,ended_at,duration_ms")
        .eq("practice_id", practiceId)
        .gte("started_at", since)
        .not("duration_ms", "is", null)
        .order("started_at", { ascending: false })
        .limit(1000),  // Cap at 1000 to avoid massive data transfers
      sb.from("cleaning_sessions")
        .select("room_name,started_at,ended_at,duration_ms")
        .eq("practice_id", practiceId)
        .gte("started_at", since)
        .not("duration_ms", "is", null)
        .order("started_at", { ascending: false })
        .limit(1000)   // Cap at 1000 to avoid massive data transfers
    ]).then(function(results){
      if(btn) btn.disabled = false;
      var roomData = results[0].data || [];
      var cleanData = results[1].data || [];
      renderStats(roomData, cleanData, days);
    }).catch(function(err){
      if(btn) btn.disabled = false;
      if(statusEl) statusEl.textContent = "Failed to load: " + (err.message || err);
    });
  };

  // Wire up controls after DOM ready
  document.addEventListener("click", function(e){
    if(e.target && e.target.id === "loadStatsBtn"){
      var range = $("statsRangeSelect");
      window.roomboardLoadStats(range ? parseInt(range.value, 10) : 30);
    }
  });
  document.addEventListener("change", function(e){
    if(e.target && e.target.id === "statsRangeSelect"){
      window.roomboardLoadStats(parseInt(e.target.value, 10));
    }
  });

})();
