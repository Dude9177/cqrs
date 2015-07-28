(function(context) {
  function cqrs() {
    this._messageDispatchers = []
  }

  cqrs.VERSION = '0.1.0'

  cqrs.prototype.commands = {}
  cqrs.prototype.events = {}

  cqrs.prototype.defineCommand = function(command) {

    if (typeof(command) === 'function') {
      if (this.commands[command.name]) throw "Command is already defined {" + command.name + "}"
      this.commands[command.name] = command
      return
    }

    var commandName = command

    if (this.commands[commandName]) throw "Command is already defined {" + commandName + "}"

    var args = Array.prototype.slice.call(arguments, 1)

    if (typeof(args[0]) === 'function') {
      this.commands[commandName] = args[0]
      return
    }

    var commandBody = args.map(function(arg) {
      return 'self.' + arg + '=' + arg + ';'
    }).join('')
    var commandFunction = 'this.commands.' + commandName + ' = function ' + commandName + '(' + args.join(', ') + ') { var self=this; ' + commandBody + ' return self;}';

    var func = new Function(commandFunction);
    func.call(this)
  }

  cqrs.prototype.defineEvent = function(event) {
    if (typeof(event) === 'function') {
      if (this.events[event.name]) throw "Event is already defined {" + event.name + "}"
      this.events[event.name] = event
      return
    }

    var eventName = event
    if (this.events[eventName]) throw "Event is already defined {" + eventName + "}"

    var args = Array.prototype.slice.call(arguments, 1)

    if (typeof(args[0]) === 'function') {
      this.events[eventName] = args[0]
      return
    }

    var eventBody = args.map(function(arg) {
      return 'self.' + arg + '=' + arg + ';'
    }).join('')
    var eventFunction = 'this.events.' + eventName + ' = function(' + args.join(', ') + ') { var self=this; ' + eventBody + ' return self;}';

    var func = new Function(eventFunction);
    func.call(this)
  }

  function MessageDispatcher(name) {
    var self = this
    self.name = name

    var _commandHandlers = {}
    var _eventHandlers = {}

    self.scan = function(object) {
      if (!object._cqrs_handleCommands) return
      for (var c = 0; c < object._cqrs_handleCommands.length; c++) {
        var commandHandlerName = object._cqrs_handleCommands[c];
        if (_commandHandlers[commandHandlerName]) throw "Command handler already registered for " + commandHandlerName

        _commandHandlers[commandHandlerName] = object[commandHandlerName]
      }

      return self
    }

    self.sendCommand = function(command) {
      var commandHandler = _commandHandlers[command.constructor.name]
      if (commandHandler) {
        commandHandler(command)
      }
    }

    return self
  }

  cqrs.prototype.createMessageDispatcher = function(name) {
    for (var i = 0; i < this._messageDispatchers.length; i++) {
      if (this._messageDispatchers[i].name === name) throw "messageDispatcher with same name exists. {" + name + "}"
    }

    var messageDispatcher = new MessageDispatcher(name)
    this._messageDispatchers.push(messageDispatcher)
    return messageDispatcher
  }

  cqrs.prototype.getMessageDispatcher = function(name) {
    for (var i = 0; i < this._messageDispatchers.length; i++) {
      if (this._messageDispatchers[i].name === name) return this._messageDispatchers[i]
    }

    throw "messageDispatcher with this name does not exists. {" + name + "}"
  }

  cqrs.prototype.iHandleCommand = function(commandName, commandHandler, object) {
    if (!object._cqrs_handleCommands) object._cqrs_handleCommands = []

    var _command = this.commands[commandName]

    if (!_command) throw "No command with this name is defined {" + commandName + "}"
    if (!(commandHandler)) throw "No command handler is defined {" + commandName + "}"
    if (!(typeof(commandHandler) === 'function' && commandHandler.constructor.name === 'GeneratorFunction')) throw "The command handler has to be a geneartor function {" + commandName + "}"

    if (object._cqrs_handleCommands.indexOf(commandName) === -1) object._cqrs_handleCommands.push(commandName)
  }

  cqrs.prototype.iHandleCommands = function(commandNames, object) {
    for (var i = 0; i < commandNames.length; i++) {
      var commandName = commandNames[i]
      var commandHandler = object[commandName]

      this.iHandleCommand(commandName, commandHandler, object)
    }
  }

  cqrs.prototype.iApplyEvent = function(eventName, eventHandler, object) {
    if (!object._cqrs_applyEvents) object._cqrs_applyEvents = []

    var _event = this.events[eventName]
    if (!_event) throw "No event with this name is defined {" + eventName + "}"

    var subscribedEvents = object._cqrs_subscribeToEvents || []
    if (subscribedEvents.indexOf(eventName) > -1) throw "An event can only be applied or subcribed by one object but not bot {" + eventName + "}"

    if (!(eventHandler)) throw "No event handler is defined {" + eventName + "}"
    if (!(typeof(eventHandler) === 'function')) throw "The event handler has to be a function {" + eventName + "}"

    if (object._cqrs_applyEvents.indexOf(eventName) === -1) object._cqrs_applyEvents.push(eventName)
  }

  cqrs.prototype.iApplyEvents = function(eventNames, object) {
    for (var i = 0; i < eventNames.length; i++) {
      var eventName = eventNames[i]
      var eventHandler = object[eventName]

      this.iApplyEvent(eventName, eventHandler, object)
    }
  }

  cqrs.prototype.iSubscribeTo = function(events, object) {
    if (!(events instanceof Array)) events = [events]

    var appliedEvents = object._cqrs_applyEvents || []

    var distinctEvents = []
    for (var i = 0; i < events.length; i++) {
      if (distinctEvents.indexOf(events[i]) > -1) continue

      var _event = this.events[events[i]]

      if (!_event) throw "No event with this name is defined {" + events[i] + "}"

      if (appliedEvents.indexOf(events[i]) > -1) throw "An event can only be applied or subcribed by one object but not bot {" + events[i] + "}"

      var eventHandler = object[events[i]]

      if (!eventHandler) throw "No event handler for event is defined {" + events[i] + "}"

      if (_event.length !== eventHandler.length) throw "The event handler has the wrong count of arguments {" + events[i] + "}. " + _event.lenth + " exptected, but " + eventHandler.length + " defined"

      distinctEvents.push(events[i])
    }

    object._cqrs_subscribeToEvents = distinctEvents
    console.log('added iSubscribeTo')
  }

  /*** Exposing Cqrs to the world ***/

  // For Node.js
  if (typeof module === "object" && module && module.exports === context) {
    module.exports = new cqrs() // For browsers
  } else {
    context.cqrs = new cqrs()
  }
}(this))
