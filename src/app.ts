/// <reference path="./components/mithril/mithril.d.ts" />
/// <reference path="./components/pouchdb.d.ts/pouchdb.d.ts" />

module burbank {
  var db = new PouchDB('burbank');

  var sync = db.sync('http://localhost:5984/burbank', {
    live: true,
    retry: true,
  }).on('change', function (info) {
    var message, doc;
    // handle change
    if (info.direction == "pull" && info.change.docs_read > 0) {
      console.log("info", info);
      //console.table("change", info.change);

      //for(var i = 0; doc = info.change.docs[i]; i++){
      //  message = vm.list.findById(doc._id);
      //  if (message){
      //    message.resetFromDoc(doc)
      //  } else {
      //    // TODO add new message
      //  }
      //}

      // FIXME the change actually includes the doc, so ideally we'd only change the data for the
      // docs that changed, or add any docs we don't have in the local message list
      vm.loadAllMessages();
    }
    m.redraw();
  }).on('paused', function () {
    // replication paused (e.g. user went offline)
  }).on('active', function () {
    // replicate resumed (e.g. user went back online)
  }).on('denied', function (info) {
    // a document failed to replicate, e.g. due to permissions
  }).on('complete', function (info) {
    // handle complete
  }).on('error', function (err) {
    // handle error
  });

  export class Message {
    _id: string;
    sender: any;  // FIXME MithrilProperty<string> doesn't work
    content: any; // FIXME MithrilProperty<string> doesn't work
    attachment: any; // FIXME MithrilProperty<File> doesn't work
    attachmentURL: any; // FIXME MithrilProperty<string> doesn't work

    // XXX m.prop really doesn't jive withe typescript classes, have to spell out everything here
    // instead of just declaring public/private argments.
    constructor (sender: string, content: string, attachment?: File, _id?: string) {
      this.sender = m.prop(sender);
      this.content = m.prop(content);
      this.attachment = m.prop(attachment);
      this.attachmentURL = m.prop();
      this._id = _id;
    }

    resetFromDoc (doc) {
    }

    save () {
      // TODO better id, include a guid after timestamp to make conflicts impossible?
      if (!this._id)
        this._id = (new Date).toISOString();

      // FIXME will fail for updates, we have to pass rev in that case
      db.put({
        _id: this._id,
        sender: this.sender(),
        content: this.content(),
      }).then((result) => {
        // we can try uploading all at once too, inline _attachment option with data key
        var file = this.attachment();
        if (file) {
          db.putAttachment(this._id, file.name, result.rev, file, file.type)
        }
      })
    }
  }

  export class MessageList {
    constructor (public list: Array<Message>) {
    }
    push(message: Message) {
      return this.list.push(message);
    }
    map(fn: (Message)=> any) {
      return this.list.map(fn);
    }
    size() {
      return this.list.length;
    }
  }

  // view-model
  //class MessageListVM // should we do it this way instead, for consistency?
  export var vm:any = {};
  vm.init = () => {
    vm.list = new MessageList([]);
    vm.scrollState = "bottom"; // stick to bottom
    vm.initialRender = true; // used for setting scroll to bottom on first render

    vm.setScrollState = (event) => {
      if (event.target.scrollTop + event.target.clientHeight == event.target.scrollHeight){
        vm.scrollState = "bottom";
      } else {
        vm.scrollState = "scrolled up";
      }
      m.redraw.strategy("none"); // no need to redraw, especially on a scroll event!
      console.log('scrollState', vm.scrollState);
    }

    vm.loadAllMessages = () => {
      db.allDocs({
        include_docs: true, 
        attachments: true // unsure about this. without it we get just the attachment metadata, which might be better (fetch actual binary data only as needed?)
      }).then(function (result) {
        var doc, message, name, blob;
        vm.list = new MessageList([]);
        for (var i = 0; i < result.rows.length; i++){
          doc = result.rows[i].doc
          message = new Message(doc.sender, doc.content, null, doc._id);
          vm.list.push(message);

          // async load attachments
          if (doc._attachments) {
            name = Object.keys(doc._attachments)[0];
            if (name) {
              // due to m.startComputation/m.endComputation in this loop, a redraw will only occur
              // after *all* the images have loaded (provided no other async stuff started, in which
              // case those have to be done too). there's a tradeoff here between number of redraws,
              // and latency for first redraw. not sure this is the right one.
              //
              // part of the problem is that a redraw is a *full* redraw. it would be nice to have
              // immutable data structures, and thus know to only redraw (even in virtual-dom) only
              // the parts that actually might have changed, instead of needing to redraw the full
              // view from scratch. that would allow redrawing after every small data change, but
              // still be efficient. i believe glimmer, the ember redrawing system, does this,
              // though simply with getters and setters. we use getters and setters in idiomatic
              // mithril too, so maybe something like glimmer can be set up?
              //
              // anyways, this may not be too problematic once i write this component to only load
              // a few dozen messages at a time, minimizing the potential for latency. also, haven't
              // actually measured the latency yet, though with large images it could easily be
              // quite substantial.

              m.startComputation(); // would sure be nice to have a wrapper around pouchdb's callbacks that does this automatically...
              db.getAttachment(doc._id, name).
                then(message.attachment).
                finally(m.endComputation);
            }
          }
        }
        vm.listLoaded = true;
        m.redraw();
      }).catch(function (err) {
        alert(err);
        console.log(err);
      });
    }

    vm.loadAllMessages();

    // a slot to store the content of a new message before it is created
    // TODO: instead, can't we bind a new message's content property?
    vm.messageContent = m.prop("");

    // adds a message to the list, and clears the content field for user convenience
    vm.addMessage = () => {
      if (vm.messageContent()) {
        var message = new Message("test", vm.messageContent())
        message.save();
        vm.list.push(message);
        vm.messageContent("");
      }
    };

    vm.addImage = (file) => {
      try {
        var message = new Message("test", vm.messageContent(), file)
        message.save();
        vm.list.push(message);
        vm.messageContent("");

        //// Get window.URL object
        //var URL = window.URL || window.webkitURL;
        //// Create ObjectURL
        //var imgURL = URL.createObjectURL(file);
        // Set img src to ObjectURL
        //showPicture.src = imgURL;
        // Revoke ObjectURL
        //showPicture.src = imgURL;
        //URL.revokeObjectURL(imgURL);
      }
      catch (e) {
        alert("oh noes, something went wrong");
        //try {
        //  // Fallback if createObjectURL is not supported
        //  var fileReader = new FileReader();
        //  fileReader.onload = function (event) {
        //    showPicture.src = event.target.result;
        //  };
        //  fileReader.readAsDataURL(file);
        //}
        //catch (e) {
        //  // Display error message
        //  var error = document.querySelector("#error");
        //  if (error) {
        //    error.innerHTML = "Neither createObjectURL or FileReader are supported";
        //  }
        //}
      }
    };
  };

  export var controller:any = function() {
    vm.init();
  };

  var scrollIfNeeded = () => {
    if (!vm.listLoaded){
      return false;
    }

    var el = document.getElementsByClassName("message-list")[0];
    if (!el || (!el.children[0] && vm.list.size() > 0)) {
      console.log("no render");
      return false; // application is not rendered yet
    }

    if (vm.scrollState == "bottom") {
      el.scrollTop = el.scrollHeight;
      console.log("yep", el.scrollTop, typeof el.children[0], vm.list.size());
    }
    return true;
  }

  // FIXME would be nice to not setInterval this, but rather only do so when changes happen. but we
  // need a callback when mithril renders to dom for this, which i don't think exists now.
  // FIXME we are never clearing this setInterval up, which will matter when we init muliple times
  // (routing)
  setInterval(scrollIfNeeded, 100);

  export var view:any = function() {

    //if (vm.initialRender) {
    //  vm.initialRender = false;
    //  // FIXME somehow get rid of this hacky setInterval and the element existence checks in
    //  // scrollIfNeeded. ideally want a callback after successful render to DOM
    //  var intervalID = setInterval(() => {
    //    if (scrollIfNeeded()){ // returns true only after dom is available and it got a chance to be useful
    //      clearInterval(intervalID);
    //    }
    //  }, 100);
    //}

    return m("div#burbank", [
      m("ol.message-list", {onscroll: vm.setScrollState}, [
        vm.list.map((message, index) => {
          var file = message.attachment();
          if (file) {
            if (!message.attachmentURL()) {
              var URL = window.URL || window.webkitURL;
              // we need to cache it, otherwise the image gets reloaded in the browser
              // for every redraw, since we get a new url every time we call createObjectURL
              message.attachmentURL(URL.createObjectURL(file));
            }
            var content = m("img", {src: message.attachmentURL(), onload: scrollIfNeeded});
          } else {
            var content = m("span", message.content());
          }
          return m("li.message", [content]);
        })
      ]),
      m("div.message-send-container", [
        m("input.upload", {
          onchange: (event) => {
            // get a reference to the taken picture or chosen file
            var files = event.target.files,
                file;
            if (files && files.length > 0) {
                file = files[0];
                vm.addImage(file)
            }
          },
          type: "file",
          accept: "image/*",
        }),
        m("div.message-content-container", [
          m("input.message-content", {
            value: vm.messageContent(),
            onkeyup: (e: KeyboardEvent) => {
              if (e.keyCode == 13){ // enter key
                vm.addMessage()
              } else {
                var input = <HTMLInputElement> e.target;
                vm.messageContent(input.value);
                m.redraw.strategy("none"); // no need to redraw if not enter key
              }
            }
          }),
        ]),
        m("button.send-message", {onclick: vm.addMessage}, "Send"),
      ]),
    ]);
  };
}

// application init
m.mount(document.body, {controller: burbank.controller, view: burbank.view});
