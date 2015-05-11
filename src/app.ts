/// <reference path="./components/mithril/mithril.d.ts" />

module burbank {
  export class Message {
    sender: any;  // FIXME MithrilProperty<string> doesn't work
    content: any; // FIXME MithrilProperty<string> doesn't work
    constructor (sender: string, content: string) {
      this.sender = m.prop(sender);
      this.content = m.prop(content);
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
  }

  // view-model
  //class MessageListVM // should we do it this way instead, for consistency?
  export var vm:any = {};
  vm.init = function() {
    vm.list = new MessageList([]);

    // a slot to store the content of a new message before it is created
    // TODO: instead, can't we bind a new message's content property?
    vm.messageContent = m.prop("");

    // adds a message to the list, and clears the content field for user convenience
    vm.addMessage = function() {
      if (vm.messageContent()) {
        vm.list.push(new Message("test", vm.messageContent()));
        vm.messageContent("");
      }
    };
  };

  export var controller:any = function() {
    vm.init();
  };

  export var view:any = function() {
    return m("html", [
      m("body", [
        m("input", {
          value: vm.messageContent(),
          onkeyup: m.withAttr("value", vm.messageContent),
          config: (element, isInitialized) => {
            if (isInitialized){ return; }
            element.addEventListener('keyup', (e: KeyboardEvent) => {
              if (e.keyCode == 13){
                m.startComputation();
                vm.addMessage()
                m.endComputation();
              }
            });
          }
        }),
        m("button", {onclick: vm.addMessage}, "Send"),
        m("ol", [
          vm.list.map(function(message, index) {
            return m("li", [
              m("span", message.content()),
            ])
          })
        ])
      ])
    ]);
  };
}

m.mount(document, {controller: burbank.controller, view: burbank.view});
