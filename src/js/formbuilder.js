/**
 * Dynamically load templates
 * @param  {[type]}   name     [description]
 * @param  {Function} callback [description]
 * @return {[type]}            [description]
 */
dust.onLoad = function(name, callback) {
  $.ajax('templates/' + name + '.tpl', {
    success: function(data) {
      callback(undefined, data);
    },
    error: function(jqXHR, textStatus, errorThrown) {
      callback(textStatus, undefined);
    }
  });
};

/**
 * Formbuilder
 * Copyright (c) 2009, 2014 (v2) Mike Botsko, Helion3 LLC (http://www.helion3.com)
 * http://www.botsko.net/blog/2009/04/jquery-form-builder-plugin/
 * Originally designed for AspenMSM, a CMS product from Trellis Development
 * Licensed under the MIT (http://www.opensource.org/licenses/mit-license.php)
 */
(function (window,undefined){

  var formbuilder = function( opts ){
    return new formbuilderEngine(opts);
  };

  var formbuilderEngine = function(opts){

    if( !_.has(opts,'targets') || !_.isObject(opts.targets) || opts.targets.length === 0 ){
      throw new Error('Invalid or missing target element(s)');
    }

    if( !_.has(opts,'save_url') || !_.isString(opts.save_url) || opts.save_url.trim() === '' ){
      throw new Error('Invalid or missing save url');
    }

    // Define all default options
    var defaultOptions = {

      // A dom-lib wrapped element
      targets: false,

      // A url we'll POST form data to on save
      save_url: false,

      // A url we'll load (GET) form data from on page load
      load_url: false,

      // Description of allowed field types
      field_types: [
        {
          key: 'text',
          label: 'Text',
          schema: {
            name: false,
            label: '',
            required: false
          }
        },{
          key: 'textarea',
          label: 'Textarea',
          schema: {
            name: false,
            label: '',
            required: false
          }
        },{
          key: 'select',
          label: 'Select',
          template: 'choices',
          schema: {
            name: false,
            label: '',
            required: false,
            choices: [{
              selected: false,
              label: ''
            }]
          }
        }
      ]

    };

    this._opts = _.assign(defaultOptions,opts);

    (function(engine){

      var targets = engine._opts.targets;

      engine.render();

      /**
       * Event listeners
       */
      
      // New form element editor
      targets.on('change', '.frmb-add-elem', function(){
        var val = $(this).val();
        engine.addFormElementEditor( engine.getFieldTypeByName(val) );
        $(this).val('');
      });

      // Add a choice entry
      targets.on('click', '.frmb-add-choice', function(e){
        e.preventDefault();
        var elem = $(this);
        var parent = elem.parents('.frmb-group').last();
        var id = parent.attr('id');

        var fieldType = engine.getFieldTypeByName( engine._model[id].type );

        engine.appendFieldToFormElementEditor( parent, fieldType );

        return false;
      });

      // Remove a form element editor
      targets.on('click', '.frmb-remove', function(e){
        e.preventDefault();
        var elem = $(this);
        var parent = elem.parents('.frmb-group:eq(0)');
        var id = parent.attr('id');
        engine.removeModel( id );
        parent.remove();
        return false;
      });

      // Update model with keyboard entries
      targets.on('keyup', 'input[type=text]', function(e){

        // specific field editor container
        var elem = $(this);
        var parent = elem.parents('.frmb-group').last();
        var id = parent.attr('id');
        var type = elem.attr('name').replace(id+'_', '');

        engine.setModelValue( id, type, elem.val() );

      });

      // Update model with checkbox entries
      targets.on('change', 'input[type=checkbox]', function(e){

        // specific field editor container
        var elem = $(this);
        var parent = elem.parents('.frmb-group').last();
        var id = parent.attr('id');
        var type = elem.attr('name').replace(id+'_', '');

        engine.setModelValue( id, type, elem.is(':checked') );

      });

      // Save
      targets.on('click', '.frmb-save', function(e){
        e.preventDefault();
        engine.save();
        return false;
      });

    })(this);

    return this;

  };

  formbuilderEngine.prototype = {

    // store options
    _opts: false,

    // current object representing the form
    _model: {},

    /**
     * Render the form editor
     * @return {[type]} [description]
     */
    render: function(){

      var self = this;

      // Pass data to the original rendering
      var frmObj = {
        field_types: this._opts.field_types
      };

      dust.render('base', frmObj, function(err, out) {

        // Append final content
        self._opts.targets.append( out );

      });
    },

    /**
     * Returns the field type object by given name
     * @param  {string} field_type_name Field type name
     * @return {object}
     */
    getFieldTypeByName: function( field_type_name ){
      return _.find(this._opts.field_types, { 'key': field_type_name });
    },

    /**
     * Add a new form element editing box
     */
    addFormElementEditor: function( field ){

      var self = this;

      if( !_.isObject(field) ){
        throw new Error('Failed to add form element editor: Invalid field object');
      }

      var name = _.isString(field.name) ? field.name : field.key + '_' + _.now();

      // Create a new model entry
      self._model[name] = _.assign(field.schema, {
        name: name,
        type: field.key
      });

      // Prep data for template
      var bodyObj = {
        name: name
      };
      bodyObj = _.assign(bodyObj,field);

      // Render base element (all fields need these base values)
      dust.render('element-base', bodyObj, function(err, out){

        var elem = $(out);

        // append base
        self._opts.targets.find('.frmb-group:last-of-type').after( elem );

        self.appendFieldToFormElementEditor( elem, field, name );

      });
    },

    /**
     * Appends secondary details to an existing form editor
     * @param  {element} frmb_group Form group description to append to
     * @param  {object} field      Field type schema to use
     */
    appendFieldToFormElementEditor: function( frmb_group, field, name ){

      if( !name ) name = _.isString(field.name) ? field.name : field.key + '_' + _.now();

      var bodyObj = {
        name: name
      };

      // load additional details template
      if( _.has(field,'template') ){

        if( _.has(this._model[name],'choices') ){
          bodyObj.name += '_choices.0';
        }

        dust.render(field.template, bodyObj, function(err, out){
          frmb_group.append( out );
        });
      }
    },

    /**
     * Sets a new value for a field's model
     * @param {string} id   Model ID
     * @param {string} type Schema field value belongs to
     * @param {string} val
     */
    setModelValue: function( id, type, val ){

      // Some paths are namespaced
      var path = false;
      if( type.indexOf('.') !== false ){
        path = type.split('.');
        type = path[0];
      }

      if( !_.isObject( this._model[id] ) ){
        throw new Error('Model has no entry for ' + id);
      }

      if( !_.has( this._model[id], type ) ){
        throw new Error('Invalid schema field ' + type + ' for model ' + id);
      }

      var fieldType = this.getFieldTypeByName( this._model[id].type );

      // Special handling for choice
      if( type === 'choices' ){

        var index = _.parseInt(path[1]);

        // exists?
        var existing = [];
        if( !_.has( this._model[id][type], index ) ){
          // create new choice entry
          this._model[id][type][index] = fieldType.choices[0];
        }

        // verify field is in schema
        if( !_.has( this._model[id][type][index], path[2] ) ){
          throw new Error('Invalid choice schema field ' + path[2] + ' for model ' + id);
        }

        // set value
        this._model[id][type][index][path[2]] = val;

        return;

      }

      this._model[id][type] = val;

    },

    /**
     * Removes a field model
     * @param  {string} id
     */
    removeModel: function( id ){

      if( !_.isObject( this._model[id] ) ){
        throw new Error('Model has no entry for ' + id);
      }

      delete this._model[id];

    },

    /**
     * Passes a JSON model of the resulting form to the server-side
     * code.
     */
    save: function(){
      console.log(this._model);
    }
  };

  // map!
  window.formbuilder = formbuilder;

})(this);