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

  function groupBy(arr, key){
    var out = {};
    arr.forEach(function(item){
      var k = item[key] || "Unknown";
      if(!out[k]) out[k] = [];
      out[k].push(item);
    });
    return out;
  }

  function barChart(title, rows, maxMs){
    // rows: [{label, ms, count}]
    if(!rows.length) return "";
    var maxVal = maxMs || Math.max.apply(null, rows.map(function(r){ return r.ms; })) || 1;
    var html = '<div class="statsChartWrap"><div class="statsChartTitle">' + esc(title) + '</div>';
    rows.forEach(function(r){
      var pct = Math.max(4, Math.round((r.ms / maxVal) * 100));
      html += '<div class="statsBarRow">'
        + '<span class="statsBarLabel">' + esc(r.label) + '</span>'
        + '<div class="statsBarTrack">'
        + '<div class="statsBarFill" style="width:' + pct + '%"></div>'
        + '</div>'
        + '<span class="statsBarVal">' + fmtDuration(r.ms) + (r.count ? ' <small>(' + r.count + ')</small>' : '') + '</span>'
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

  function dayLabel(isoStr){
    var d = new Date(isoStr);
    return (d.getMonth()+1) + "/" + d.getDate();
  }

  function renderStats(roomSessions, cleanSessions, days){
    var today = new Date(); today.setHours(0,0,0,0);

    // ---- Summary tiles ----
    var todayRoom = roomSessions.filter(function(s){
      return new Date(s.started_at) >= today;
    });
    var avgRoom = avg(roomSessions.map(function(s){ return s.duration_ms || 0; }));
    var avgClean = avg(cleanSessions.map(function(s){ return s.duration_ms || 0; }));
    var summaryEl = $("statsSummaryRow");
    if(summaryEl){
      summaryEl.innerHTML =
        tile("Today's rooms", todayRoom.length, "visits")
        + tile("Avg room time", fmtDuration(avgRoom), "last " + days + " days")
        + tile("Avg clean time", fmtDuration(avgClean), "last " + days + " days")
        + tile("Total sessions", roomSessions.length, "last " + days + " days");
      summaryEl.hidden = false;
    }

    // ---- Room bar chart ----
    var byRoom = groupBy(roomSessions, "room_name");
    var roomRows = Object.keys(byRoom).map(function(name){
      var sessions = byRoom[name];
      var durations = sessions.filter(function(s){ return s.duration_ms; }).map(function(s){ return s.duration_ms; });
      return { label: name, ms: avg(durations), count: sessions.length };
    }).filter(function(r){ return r.ms > 0; });
    roomRows.sort(function(a,b){ return b.ms - a.ms; });

    // ---- Doctor bar chart ----
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
    roomSessions.forEach(function(s){
      var h = new Date(s.started_at).getHours();
      hourCounts[h]++;
    });
    var peakCount = Math.max.apply(null, hourCounts) || 1;
    var hourRows = [];
    for(var h = 7; h <= 19; h++){
      var label = h === 0 ? "12am" : h < 12 ? h + "am" : h === 12 ? "12pm" : (h-12) + "pm";
      hourRows.push({ label: label, ms: hourCounts[h] * (peakCount > 0 ? (avgRoom / peakCount) * hourCounts[h] : 1), count: hourCounts[h] });
    }

    // ---- 14-day trend ----
    var trendMap = {};
    for(var i = 0; i < Math.min(days, 14); i++){
      var d = new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate() - i);
      trendMap[d.toDateString()] = { label: dayLabel(d.toISOString()), count: 0 };
    }
    roomSessions.forEach(function(s){
      var key = new Date(s.started_at).toDateString();
      if(trendMap[key]) trendMap[key].count++;
    });
    var maxDayCount = Math.max.apply(null, Object.values(trendMap).map(function(v){ return v.count; })) || 1;
    var trendRows = Object.values(trendMap).reverse();

    var chartEl = $("statsRoomChart");
    if(chartEl){
      var html = "";
      if(roomRows.length) html += barChart("Avg room time by room", roomRows);
      if(docRows.length) html += barChart("Avg room time by doctor", docRows);

      // Hour chart (visual only, count-based)
      if(roomSessions.length){
        html += '<div class="statsChartWrap"><div class="statsChartTitle">Sessions by time of day</div>';
        hourRows.forEach(function(r){
          var pct = Math.max(2, Math.round((r.count / peakCount) * 100));
          html += '<div class="statsBarRow">'
            + '<span class="statsBarLabel">' + esc(r.label) + '</span>'
            + '<div class="statsBarTrack"><div class="statsBarFill teal" style="width:' + pct + '%"></div></div>'
            + '<span class="statsBarVal">' + r.count + '</span>'
            + '</div>';
        });
        html += '</div>';
      }

      // 14-day trend mini sparkline
      if(trendRows.length > 1){
        html += '<div class="statsChartWrap"><div class="statsChartTitle">Sessions per day (last ' + Math.min(days,14) + ' days)</div>';
        html += '<div class="statsTrendRow">';
        trendRows.forEach(function(r){
          var pct = Math.max(4, Math.round((r.count / maxDayCount) * 100));
          html += '<div class="statsTrendBar" title="' + esc(r.label) + ': ' + r.count + '">'
            + '<div class="statsTrendFill" style="height:' + pct + '%"></div>'
            + '<span class="statsTrendLabel">' + esc(r.label) + '</span>'
            + '</div>';
        });
        html += '</div></div>';
      }

      chartEl.innerHTML = html;
      chartEl.hidden = false;
    }

    var statusEl = $("statsStatusLine");
    if(statusEl) statusEl.textContent =
      roomSessions.length + " room session" + (roomSessions.length !== 1 ? "s" : "")
      + " and " + cleanSessions.length + " cleaning session" + (cleanSessions.length !== 1 ? "s" : "")
      + " in the last " + days + " days.";
  }

  function tile(label, value, sub){
    return '<div class="statsTile"><div class="statsTileValue">' + esc(String(value)) + '</div>'
      + '<div class="statsTileLabel">' + esc(label) + '</div>'
      + (sub ? '<div class="statsTileSub">' + esc(sub) + '</div>' : '')
      + '</div>';
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
