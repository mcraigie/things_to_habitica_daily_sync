#!/usr/bin/env osascript -l JavaScript

ObjC.import("AppKit");

class ThingsBridge {
  constructor() {
    console.log("Checking for Things App...");

    if (Application("Things3").running()) {
      console.log("Things is already running");
    } else {
      console.log("Launching Things");

      $.NSWorkspace.sharedWorkspace.launchAppWithBundleIdentifierOptionsAdditionalEventParamDescriptorLaunchIdentifier(
        "com.culturedcode.ThingsMac",
        $.NSWorkspaceLaunchAsync | $.NSWorkspaceLaunchAndHide,
        $.NSAppleEventDescriptor.nullDescriptor,
        null
      );
    }
  }

  logJS(object) {
    console.log(JSON.stringify(object, undefined, "\t"));
  }

  logJXA(object) {
    this.logJS(object.properties());
  }

  yesterday() {
    var yesterday = new Date();
    yesterday.setHours(-1, -1, -1, -1);
    return yesterday;
  }

  // You can't use the return value of the JXA ".whose()" function like a normal array of
  // JS objects (neither foo.forEach() or foo.map() work correctly as far as I can tell).
  // This function makes everything much easier to work with.
  asRealArray(input) {
    var arr = [];
    for (var i = 0; i < input.length; i++) {
      arr.push(input[i].properties());
    }
    return arr;
  }

  logbook() {
    return Application("Things3").lists.byName("Logbook");
  }

  completedToday() {
    return this.asRealArray(
      this.logbook().toDos.whose({ completionDate: { _greaterThan: this.yesterday() } })
    );
  }

  syncTodaysTasks() {
    this.completedToday().forEach(t => this.createAndCompleteTodo(t));
  }

  // The doShellScript function must be called on the current application
  currentApp() {
    var current = Application.currentApplication();
    current.includeStandardAdditions = true;
    return current;
  }

  executeShellScript(command) {
    return this.currentApp().doShellScript(command);
  }

  createAndCompleteTodo(task) {
    var response = this.createTodo(task);
    if (response.success == true) {
      this.completeTodo(response.data.id);
    }
  }

  createTodo(task) {
    var constructedRequest = this.constructRequest(task);

    var response = this.executeShellScript(constructedRequest);
    return JSON.parse(response);
  }

  // For some reason you cannot mark a todo as being completed at the time of creation.
  // This function is for doing that.
  completeTodo(id) {
    var response = this.executeShellScript(
      `curl -X "POST" -H "Content-Length:0" ${this.authHeaders()} ${this.scoreURL(id)}`
    );
  }

  constructRequest(task) {
    return `curl -s -X POST ${this.tasksURL()} ${this.headers()} -d ${this.constructBody(task)}`;
  }

  // I choose to lightly obfuscate the task text by removing vowels.
  // The unobfuscated version: "text: task.name,"
  constructBody(task) {
    var body = {
      text: `${task.id}-${task.name.replace(/[aeiou ]/gi, "")}`,
      type: "todo",
      notes: `Synced from Things App ${new Date().toLocaleString()}`,
    };
    return `'${JSON.stringify(body)}'`;
  }

  // Your Habitica User ID and API Key go here.
  // You can find them at https://habitica.com/user/settings/api
  authHeaders() {
    var userId = "";
    var APIKey = "";
    return `-H "x-api-user: ${userId}" -H "x-api-key: ${APIKey}"`;
  }

  headers() {
    return `-H "Content-Type:application/json" --compressed ${this.authHeaders()}`;
  }

  baseURL() {
    return "https://habitica.com/api/v3/tasks";
  }

  tasksURL() {
    return `${this.baseURL()}/user`;
  }

  scoreURL(todoId) {
    return `${this.baseURL()}/${todoId}/score/up`;
  }
}

function run(argv) {
  var thingsBridge = new ThingsBridge();
  console.log("Starting sync.");
  thingsBridge.syncTodaysTasks();
  console.log("Sync process complete.");
}
