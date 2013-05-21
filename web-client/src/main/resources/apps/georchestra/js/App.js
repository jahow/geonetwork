Ext.namespace('GeoNetwork');

var catalogue;
var app;
var cookie;

GeoNetwork.app = function () {
    // private vars:
    var geonetworkUrl;
    var searching = false;
    var editorWindow;
    var editorPanel;
    
    /**
     * Application parameters are :
     *
     *  * any search form ids (eg. any)
     *  * mode=1 for visualization
     *  * advanced: to open advanced search form by default
     *  * search: to trigger the search
     *  * uuid: to display a metadata record based on its uuid
     *  * extent: to set custom map extent
     */
    var urlParameters = {};
    
    /**
     * Catalogue manager
     */
    var catalogue;
    
    /**
     * An interactive map panel for data visualization
     */
    var searchForm, facetsPanel, resultsPanel, metadataResultsView, tBar, bBar,
        mainTagCloudViewPanel, infoPanel,
        visualizationModeInitialized = false;
    
    /**
     * Create a language switcher mode
     *
     * @return
     */
    function createLanguageSwitcher(lang) {
        return new Ext.form.FormPanel({
            renderTo: 'lang-form',
            width: 95,
            border: false,
            layout: 'hbox',
            hidden:  GeoNetwork.Util.locales.length === 1 ? true : false,
            items: [new Ext.form.ComboBox({
                mode: 'local',
                triggerAction: 'all',
                width: 95,
                store: new Ext.data.ArrayStore({
                    idIndex: 2,
                    fields: ['id', 'name', 'id2'],
                    data: GeoNetwork.Util.locales
                }),
                valueField: 'id2',
                displayField: 'name',
                value: lang,
                listeners: {
                    select: function (cb, record, idx) {
                        window.location.replace('?hl=' + cb.getValue());
                    }
                }
            })]
        });
    }
    
    
    /**
     * Create a default login form and register extra events in case of error.
     *
     * @return
     */
    function createLoginForm() {
        var loginForm = new GeoNetwork.LoginForm({
            renderTo: 'login-form',
            catalogue: catalogue,
            layout: 'hbox',
            hideLoginLabels: GeoNetwork.hideLoginLabels
        });
        
        catalogue.on('afterBadLogin', loginAlert, this);
        
        // Store user info in cookie to be displayed if user reload the page
        // Register events to set cookie values
        catalogue.on('afterLogin', function () {
            cookie.set('user', catalogue.identifiedUser);
        });
        catalogue.on('afterLogout', function () {
            cookie.set('user', undefined);
        });
        
        // Refresh login form if needed
        var user = cookie.get('user');
        if (user) {
            catalogue.identifiedUser = user;
            loginForm.login(catalogue, true);
        }
    }
    
    /**
     * Error message in case of bad login
     *
     * @param cat
     * @param user
     * @return
     */
    function loginAlert(cat, user) {
        Ext.Msg.show({
            title: 'Login',
            msg: 'Login failed. Check your username and password.',
            /* TODO : Get more info about the error */
            icon: Ext.MessageBox.ERROR,
            buttons: Ext.MessageBox.OK
        });
    }
    
    /**
     * Create a default search form with advanced mode button
     *
     * @return
     */
    function createSearchForm() {
        
                // Add advanced mode criteria to simple form - start
        var advancedCriteria = [];
        var services = catalogue.services;
//        var orgNameField = new GeoNetwork.form.OpenSearchSuggestionTextField({
//            hideLabel: false,
//            minChars: 0,
//            hideTrigger: false,
//            url: services.opensearchSuggest,
//            field: 'orgName', 
//            name: 'E_orgName', 
//            fieldLabel: OpenLayers.i18n('org')
//        });
        // Multi select organisation field 
        var orgNameStore = new GeoNetwork.data.OpenSearchSuggestionStore({
            url: services.opensearchSuggest,
            rootId: 1,
            baseParams: {
                field: 'orgName'
            }
        });
        var orgNameField = new Ext.ux.form.SuperBoxSelect({
            hideLabel: false,
            minChars: 0,
            queryParam: 'q',
            hideTrigger: false,
            id: 'E_orgName',
            name: 'E_orgName',
            store: orgNameStore,
            valueField: 'value',
            displayField: 'value',
            valueDelimiter: ' or ',
//            tpl: tpl,
            fieldLabel: OpenLayers.i18n('org')
        });
        
        
        
        
        // Multi select keyword
        var themekeyStore = new GeoNetwork.data.OpenSearchSuggestionStore({
            url: services.opensearchSuggest,
            rootId: 1,
            baseParams: {
                field: 'keyword'
            }
        });
//        FIXME : could not underline current search criteria in tpl
//        var tpl = '<tpl for="."><div class="x-combo-list-item">' + 
//            '{[values.value.replace(Ext.getDom(\'E_themekey\').value, \'<span>\' + Ext.getDom(\'E_themekey\').value + \'</span>\')]}' + 
//          '</div></tpl>';
        var themekeyField = new Ext.ux.form.SuperBoxSelect({
            hideLabel: false,
            minChars: 0,
            queryParam: 'q',
            hideTrigger: false,
            id: 'E_keyword',
            name: 'E_keyword',
            store: themekeyStore,
            valueField: 'value',
            displayField: 'value',
            valueDelimiter: ' or ',
//            tpl: tpl,
            fieldLabel: OpenLayers.i18n('keyword')
//            FIXME : Allow new data is not that easy
//            allowAddNewData: true,
//            addNewDataOnBlur: true,
//            listeners: {
//                newitem: function(bs,v, f){
//                    var newObj = {
//                            value: v
//                        };
//                    bs.addItem(newObj, true);
//                }
//            }
        });
        
        
        var when = new Ext.form.FieldSet({
            title: OpenLayers.i18n('when'),
            autoWidth: true,
            //layout: 'row',
            defaultType: 'datefield',
            collapsible: true,
            collapsed: true,
            items: GeoNetwork.util.SearchFormTools.getWhen()
        });
        
        
        var catalogueField = GeoNetwork.util.SearchFormTools.getCatalogueField(services.getSources, services.logoUrl, true);
        var groupField = GeoNetwork.util.SearchFormTools.getGroupField(services.getGroups, true);
        var metadataTypeField = GeoNetwork.util.SearchFormTools.getMetadataTypeField(true);
        var categoryField = GeoNetwork.util.SearchFormTools.getCategoryField(services.getCategories, '../images/default/category/', true);
        var validField = GeoNetwork.util.SearchFormTools.getValidField(true);
        var spatialTypes = GeoNetwork.util.SearchFormTools.getSpatialRepresentationTypeField(null, true);
        var denominatorField = GeoNetwork.util.SearchFormTools.getScaleDenominatorField(true);
        var statusField = GeoNetwork.util.SearchFormTools.getStatusField(services.getStatus, true);
        
        // Add hidden fields to be use by quick metadata links from the admin panel (eg. my metadata).
        var ownerField = new Ext.form.TextField({
            name: 'E__owner',
            hidden: true
        });
        var isHarvestedField = new Ext.form.TextField({
            name: 'E__isHarvested',
            hidden: true
        });
        
        advancedCriteria.push(themekeyField, orgNameField, categoryField, 
                                when, spatialTypes, denominatorField, 
                                catalogueField, groupField, 
                                metadataTypeField, validField, statusField, ownerField, isHarvestedField);
        
        // Create INSPIRE fields if enabled in administration
        var inspirePanel = catalogue.getInspireInfo().enableSearchPanel === "true";
        if (inspirePanel) {
            var inspire = new Ext.form.FieldSet({
                title: OpenLayers.i18n('inspireSearchOptions'),
                collapsible: true,
                collapsed: true,
                items:  GeoNetwork.util.INSPIRESearchFormTools.getINSPIREFields(catalogue.services, true)
            });
            advancedCriteria.push(inspire);
        }
        
        var adv = new Ext.form.FieldSet({
            title: OpenLayers.i18n('advancedSearchOptions'),
            autoHeight: true,
            collapsible: true,
            collapsed: urlParameters.advanced !== undefined ? false : true,
            defaultType: 'checkbox',
            defaults: {
                anchor: '100%'
            },
            items: advancedCriteria
        });
        
        // Check good map options if we load map config from WMC or OWS
        var mapOptions;
        if(GeoNetwork.map.CONTEXT || GeoNetwork.map.OWS) {
            mapOptions = GeoNetwork.map.CONTEXT_MAP_OPTIONS;
        } else {
            mapOptions = GeoNetwork.map.MAP_OPTIONS;
        }
        
        var formItems = [];
        
        // Check good map options if we load map config from WMC or OWS
        var mapOptions;
        if(GeoNetwork.map.CONTEXT || GeoNetwork.map.OWS) {
            mapOptions = GeoNetwork.map.CONTEXT_MAP_OPTIONS;
        } else {
            mapOptions = GeoNetwork.map.MAP_OPTIONS;
        }
        
        formItems.push(
                new GeoNetwork.form.OpenSearchSuggestionTextField({
                    hideLabel: true,
                    minChars: 2,
                    loadingText: '...',
                    hideTrigger: true,
                    url: catalogue.services.opensearchSuggest
                }),
                GeoNetwork.util.SearchFormTools.getTypesFieldWithAutocompletion(catalogue.services),
                GeoNetwork.util.SearchFormTools.getSimpleMap(GeoNetwork.map.BACKGROUND_LAYERS, mapOptions, 
                GeoNetwork.searchDefault.activeMapControlExtent, {width: 290}),
                adv, 
                GeoNetwork.util.SearchFormTools.getOptions(catalogue.services, undefined)
        );
        // Add advanced mode criteria to simple form - end
        
        
        // Hide or show extra fields after login event
        var adminFields = [groupField, metadataTypeField, validField, statusField];
        Ext.each(adminFields, function (item) {
            item.setVisible(false);
        });
        
        catalogue.on('afterLogin', function () {
            Ext.each(adminFields, function (item) {
                item.setVisible(true);
            });
            groupField.getStore().reload();
        });
        catalogue.on('afterLogout', function () {
            Ext.each(adminFields, function (item) {
                item.setVisible(false);
            });
            groupField.getStore().reload();
        });
        
        
        return new GeoNetwork.SearchFormPanel({
            id: 'searchForm',
            stateId: 's',
            searchCb: function () {
                if (metadataResultsView && Ext.getCmp('geometryMap')) {
                    metadataResultsView.addMap(Ext.getCmp('geometryMap').map, true);
                }
                var any = Ext.get('E_any');
                if (any) {
                    if (any.getValue() === OpenLayers.i18n('fullTextSearch')) {
                        any.setValue('');
                    }
                }
                
                catalogue.startRecord = 1; // Reset start record
                search();
            },
            padding: 5,
            defaults: {
                anchor: '100%'
            },
            listeners: {
                onreset: function () {
                    facetsPanel.reset();
                    this.fireEvent('search');
                }
            },
            items: formItems
        });
    }
    
    function search() {
        searching = true;
        catalogue.search('searchForm', app.loadResults, null, catalogue.startRecord, true);
    }
    
    function initPanels() {
        var infoPanel = Ext.getCmp('infoPanel'), 
        resultsPanel = Ext.getCmp('resultsPanel');
        if (infoPanel.isVisible()) {
            infoPanel.hide();
        }
        if (!resultsPanel.isVisible()) {
            resultsPanel.show();
        }
    }
    /**
     * Bottom bar
     *
     * @return
     */
    function createBBar() {
        var previousAction = new Ext.Action({
            id: 'previousBt',
            text: '&lt;&lt;',
            handler: function () {
                var from = catalogue.startRecord - parseInt(Ext.getCmp('E_hitsperpage').getValue(), 10);
                if (from > 0) {
                    catalogue.startRecord = from;
                    search();
                }
            },
            scope: this
        });
        
        var nextAction = new Ext.Action({
            id: 'nextBt',
            text: '&gt;&gt;',
            handler: function () {
                catalogue.startRecord += parseInt(Ext.getCmp('E_hitsperpage').getValue(), 10);
                search();
            },
            scope: this
        });
        
        return new Ext.Toolbar({
            items: [previousAction, '|', nextAction, '|', {
                xtype: 'tbtext',
                text: '',
                id: 'info'
            }]
        });
        
    }
    
    // Custom function to add extract and visualize actions in MDmenu and ViewPanel menu
    // OtherActions menu is managed differently
    function addExtractActions() {
        
        var urlVisu = '/mapfishapp/';
        var urlExtract = '/extractorapp/';
        
        // this is the MetadataMenu
        var extractAction = new Ext.Action({
            text: OpenLayers.i18n('extractData'),
            handler: function() {
                app.extractMetadata(urlExtract, this.record.get('id'));
            },
            scope: this
        });
        var visuAction = new Ext.Action({
            text: OpenLayers.i18n('visualizeData'),
            handler: function() {
                app.extractMetadata(urlVisu, this.record.get('id'));
            },
            scope: this
        });
        this.insert(0,visuAction);
        this.insert(0,extractAction);
    }
    
    
    /**
     * Results panel layout with top, bottom bar and DataView
     *
     * @return
     */
    function createResultsPanel(permalinkProvider) {
    	
    	metadataResultsView = new GeoNetwork.MetadataResultsView({
            catalogue: catalogue,
            displaySerieMembers: true,
            autoScroll: true,
            tpl: GeoNetwork.Templates.FULL,
            featurecolor: GeoNetwork.Settings.results.featurecolor,
            colormap: GeoNetwork.Settings.results.colormap,
            featurecolorCSS: GeoNetwork.Settings.results.featurecolorCSS,
            addCustomAction: addExtractActions
        });
        
        catalogue.resultsView = metadataResultsView;

        // Extract and Visualize action
        var extractAction = new Ext.Action({
            text:  OpenLayers.i18n('extractData'),
            handler: function() {
                app.extractMetadata('/extractorapp/');
            }
        });
        
        var visuAction = new Ext.Action({
            text: OpenLayers.i18n('visualizeData'),
            handler: function() {
                app.extractMetadata('/mapfishapp/');
            }
        });
        
        tBar = new GeoNetwork.MetadataResultsToolbar({
            catalogue: catalogue,
            searchFormCmp: Ext.getCmp('searchForm'),
            sortByCmp: Ext.getCmp('E_sortBy'),
            metadataResultsView: metadataResultsView,
            permalinkProvider: permalinkProvider,
            customOtherActions: [extractAction,visuAction]
        });
        
        bBar = createBBar();
        
        var resultPanel = new Ext.Panel({
            id: 'resultsPanel',
            border: false,
            hidden: true,
            bodyCssClass: 'md-view',
            autoWidth: true,
            layout: 'fit',
            tbar: tBar,
            items: metadataResultsView,
            // paging bar on the bottom
            bbar: bBar
        });
        return resultPanel;
    }
    /**
     * Main tagcloud displayed in the information panel
     *
     * @return
     */
    function createMainTagCloud() {
        var tagCloudView = new GeoNetwork.TagCloudView({
            catalogue: catalogue,
            query: 'fast=true&summaryOnly=true',
            renderTo: 'tag',
            onSuccess: 'app.loadResults'
        });
        
        return tagCloudView;
    }
    /**
     * Create latest metadata panel.
     */
    function createLatestUpdate() {
        var latestView = new GeoNetwork.MetadataResultsView({
            catalogue: catalogue,
            autoScroll: true,
            tpl: GeoNetwork.Settings.latestTpl
        });
        var latestStore = GeoNetwork.Settings.mdStore();
        latestView.setStore(latestStore);
        latestStore.on('load', function () {
            Ext.ux.Lightbox.register('a[rel^=lightbox]');
        });
        var p = new Ext.Panel({
            border: false,
            bodyCssClass: 'md-view',
            items: latestView,
            renderTo: 'latest'
        });
        catalogue.kvpSearch(GeoNetwork.Settings.latestQuery, null, null, null, true, latestView.getStore());
    }
    function loadCallback(el, success, response, options) {
        if (success) {
            createMainTagCloud();
            createLatestUpdate();
        } else {
            Ext.get('infoPanel').getUpdater().update({url: 'home_eng.html'});
            Ext.get('helpPanel').getUpdater().update({url: 'help_eng.html'});
        }
    }
    /** private: methode[createInfoPanel]
     *  Main information panel displayed on load
     *
     *  :return:
     */
    function createInfoPanel() {
        return new Ext.Panel({
            border: true,
            id: 'infoPanel',
            baseCls: 'md-info',
            autoWidth: true,
            contentEl: 'infoContent',
            autoLoad: {
                url: 'home_' + catalogue.LANG + '.html',
                callback: loadCallback,
                scope: this,
                loadScripts: false
            }
        });
    }
    /** private: methode[createHelpPanel]
     *  Help panel displayed on load
     *
     *  :return:
     */
    function createHelpPanel() {
        return new Ext.Panel({
            border: false,
            frame: false,
            baseCls: 'none',
            id: 'helpPanel',
            autoWidth: true,
            renderTo: 'shortcut',
            autoLoad: {
                url: 'help_' + catalogue.LANG + '.html',
                callback: initShortcut,
                scope: this,
                loadScripts: false
            }
        });
    }
    
    /**
     * Main tagcloud displayed in the information panel
     *
     * @return
     */
    function createMainTagCloud(){
        var tagCloudView = new GeoNetwork.TagCloudView({
            catalogue: catalogue,
            query: 'fast=true&summaryOnly=true',
            renderTo: 'tag',
            onSuccess: 'app.loadResults'
        });
        
        return tagCloudView;
    }
    /**
     * Create latest metadata panel.
     */
    function createLatestUpdate(){
        var latestView = new GeoNetwork.MetadataResultsView({
            catalogue: catalogue,
            autoScroll: true,
            tpl: GeoNetwork.Settings.latestTpl
        });
        var latestStore = GeoNetwork.Settings.mdStore();
        latestView.setStore(latestStore);
        latestStore.on('load', function(){
            Ext.ux.Lightbox.register('a[rel^=lightbox]');
        });
        new Ext.Panel({
            border: false,
            bodyCssClass: 'md-view',
            items: latestView,
            renderTo: 'latest'
        });
        catalogue.kvpSearch(GeoNetwork.Settings.latestQuery, null, null, null, true, latestView.getStore());
    }
    function show(uuid, record, url, maximized, width, height) {
        var win = new GeoNetwork.view.ViewWindow({
            serviceUrl: url,
            lang: this.lang,
            currTab: GeoNetwork.defaultViewMode || 'simple',
            printDefaultForTabs: GeoNetwork.printDefaultForTabs || false,
            printUrl: GeoNetwork.printUrl || 'print.html',
            catalogue: this,
            maximized: maximized || false,
            metadataUuid: uuid,
            record: record,
            resultsView: this.resultsView,
            addCustomAction: addExtractActions
            });
        win.show(this.resultsView);
        win.alignTo(Ext.getBody(), 'tr-tr');
        
        
        
        // Adapt page title and meta according to current record
        
        // If more than one metadata records opened, the last one opened set the title
        // When metadata windows is closed, reset to default title
        win.on('close', function () {
            GeoNetwork.Util.updateHeadInfo({
                title: catalogue.getInfo().name
            });
        });
        
        // Get title, keywords and author for current record
        // in order to populate the META tag in the HEAD of the HTML page.
        var contacts = [];
        Ext.each(record.get('contact'), function (item) {
             contacts.push(item.name);
        });
        var subjects = [];
        Ext.each(record.get('subject'), function (item) {
            subjects.push(item.value);
        });
        GeoNetwork.Util.updateHeadInfo({
            title: catalogue.getInfo().name + ' | ' 
                   + record.get('title') 
                   + (record.get('type') ? ' (' + record.get('type') + ')' : ''),
            meta: {
                subject: record.get('abstract'),
                keywords: subjects,
                author: contacts
            }
        });
    }
    function edit(metadataId, create, group, child){
        
        if (!this.editorWindow) {
            this.editorPanel = new GeoNetwork.editor.EditorPanel({
                defaultViewMode: GeoNetwork.Settings.editor.defaultViewMode,
                catalogue: catalogue,
                xlinkOptions: {CONTACT: true}
            });
            
            this.editorWindow = new Ext.Window({
                tools: [{
                    id: 'newwindow',
                    qtip: OpenLayers.i18n('newWindow'),
                    handler: function (e, toolEl, panel, tc) {
                        window.open(GeoNetwork.Util.getBaseUrl(location.href) + "#edit=" + panel.getComponent('editorPanel').metadataId);
                        panel.hide();
                    },
                    scope: this
                }],
                title: OpenLayers.i18n('mdEditor'),
                id : 'editorWindow',
                layout: 'fit',
                modal: false,
                items: this.editorPanel,
                closeAction: 'hide',
                collapsible: true,
                collapsed: false,
                // Unsuported. Needs some kind of component to store minimized windows
                maximizable: false,
                maximized: true,
                resizable: true,
//                constrain: true,
                width: 980,
                height: 800
            });
            this.editorPanel.setContainer(this.editorWindow);
            this.editorPanel.on('editorClosed', function () {
                Ext.getCmp('searchForm').fireEvent('search');
            });
        }
        
        if (metadataId) {
            this.editorWindow.show();
            this.editorPanel.init(metadataId, create, group, child);
        }
    }
    
    function createHeader() {
        var info = catalogue.getInfo();
        Ext.getDom('title').innerHTML = '<img class="catLogo" src="../../images/logos/' + info.siteId + '.gif"/>&nbsp;' + info.name;
        document.title = info.name;
    }
    
    // public space:
    return {
        // Default widgets function overriden
        switchMode: function () {},
        getIMap: function () {return this;},
        addWMC: function(url) {
            window.open('/mapfishapp/?wmc=' + url);
        },
        addWMSLayer: function (args) {
            var layer = args[0];
            
            // Send layers (no service) to mapfishapp
            var jsonObject = {services: [], layers: []};
            
            jsonObject.layers.push({
                layername: layer[2],
                metadataURL: app.getCatalogue().URL + '?uuid=' + layer[3],
                owstype: 'WMS',
                owsurl: layer[1],
                title: layer[0]
            });

            var form = Ext.DomHelper.append(Ext.getBody(), {
              tag: 'form',
              action: '/mapfishapp/',
              target: "_blank",
              method: 'post'
            });

            var input = Ext.DomHelper.append(form, {
              tag: 'input',
              name: 'data'
            });

            input.value = new OpenLayers.Format.JSON().write(jsonObject);
            form.submit();
            Ext.removeNode(form);
        },
        init: function () {
            geonetworkUrl = GeoNetwork.URL || window.location.href.match(/(http.*\/.*)\/apps\/georchestra.*/, '')[1];

            urlParameters = GeoNetwork.Util.getParameters(location.href);
            var lang = urlParameters.hl || GeoNetwork.Util.defaultLocale;
            if (urlParameters.extent) {
                urlParameters.bounds = new OpenLayers.Bounds(urlParameters.extent[0], urlParameters.extent[1], urlParameters.extent[2], urlParameters.extent[3]);
            }
            
            if (urlParameters.wmc) {
               GeoNetwork.map.CONTEXT = urlParameters.wmc;
            }
            if (urlParameters.ows) {
               GeoNetwork.map.OWS = urlParameters.ows;
            }
            
            // Init cookie
            cookie = new Ext.state.CookieProvider({
                expires: new Date(new Date().getTime() + (1000 * 60 * 60 * 24 * 365))
            });
            
            // set a permalink provider which will be the main state provider.
            var permalinkProvider = new GeoExt.state.PermalinkProvider({encodeType: false});
            
            Ext.state.Manager.setProvider(permalinkProvider);
            
            // Create connexion to the catalogue
            catalogue = new GeoNetwork.Catalogue({
                statusBarId: 'info',
                lang: lang,
                hostUrl: geonetworkUrl,
                mdOverlayedCmpId: 'resultsPanel',
                adminAppUrl: geonetworkUrl + '/srv/' + lang + '/admin',
                // Declare default store to be used for records and summary
                metadataStore: GeoNetwork.Settings.mdStore ? GeoNetwork.Settings.mdStore() : GeoNetwork.data.MetadataResultsStore(),
                metadataCSWStore : GeoNetwork.data.MetadataCSWResultsStore(),
                summaryStore: GeoNetwork.data.MetadataSummaryStore(),
                editMode: 2, // TODO : create constant
                metadataEditFn: edit,
                metadataShowFn: show
            });
            
            // Extra stuffs
            infoPanel = createInfoPanel();
            helpPanel = createHelpPanel();
            
            createHeader();
            
            // Search form
            searchForm = createSearchForm();
            
            // Search result
            resultsPanel = createResultsPanel(permalinkProvider);
            
            // Top navigation widgets
            createLanguageSwitcher(lang);
            createLoginForm();
            edit();
            
            
            // Register events on the catalogue
            
            var margins = '35 0 0 0';
            var breadcrumb = new Ext.Panel({
                layout:'table',
                cls: 'breadcrumb',
                defaultType: 'button',
                border: false,
                split: false,
                layoutConfig: {
                    columns:3
                }
            });
            facetsPanel = new GeoNetwork.FacetsPanel({
                searchForm: searchForm,
                breadcrumb: breadcrumb,
                maxDisplayedItems: GeoNetwork.Settings.facetMaxItems || 7,
                facetListConfig: GeoNetwork.Settings.facetListConfig || []
            });
            
            var viewport = new Ext.Viewport({
                layout: 'border',
                id: 'vp',
                items: [{
                    region: 'west',
                    id: 'west',
                    split: true,
                    minWidth: 300,
                    width: 300,
                    maxWidth: 400,
                    autoScroll: true,
                    collapsible: true,
                    hideCollapseTool: true,
                    collapseMode: 'mini',
                    margins: margins,
                    //layout : 's',
                    forceLayout: true,
                    layoutConfig: {
                        animate: true
                    },
                    items: [searchForm, breadcrumb, facetsPanel]
                }, {
                    region: 'center',
                    id: 'center',
                    split: true,
                    margins: margins,
                    items: [infoPanel, resultsPanel]
                }]
            });
            
            if (urlParameters.edit !== undefined && urlParameters.edit !== '') {
                catalogue.metadataEdit(urlParameters.edit);
            }
            if (urlParameters.create !== undefined) {
                resultsPanel.getTopToolbar().createMetadataAction.fireEvent('click');
            }
            if (urlParameters.uuid !== undefined) {
                catalogue.metadataShow(urlParameters.uuid, true);
            } else if (urlParameters.id !== undefined) {
                catalogue.metadataShowById(urlParameters.id, true);
            }
            
            // FIXME : should be in Search field configuration
            Ext.get('E_any').setWidth(285);
            Ext.get('E_any').setHeight(28);
            if (GeoNetwork.searchDefault.activeMapControlExtent) {
                Ext.getCmp('geometryMap').setExtent();
            }
            if (urlParameters.bounds) {
                Ext.getCmp('geometryMap').map.zoomToExtent(urlParameters.bounds);
            }
            
            var events = ['afterDelete', 'afterRating', 'afterLogout', 'afterLogin'];
            Ext.each(events, function (e) {
                catalogue.on(e, function () {
                    if (searching === true) {
                        searchForm.fireEvent('search');
                    }
                });
            });

            // Hack to run search after all app is rendered within a sec ...
            // It could have been better to trigger event in SearchFormPanel#applyState
            // FIXME
            if (urlParameters.s_search !== undefined) {
                setTimeout(function () {
                    searchForm.fireEvent('search');
                }, 500);
            }
        },
        getCatalogue: function () {
            return catalogue;
        },
        /**
         * Send metadata.service.extract request
         */
        extractMetadata: function(destUrl, id) {
            var urlService = catalogue.services.mdExtract;
            if(id && typeof(id) == 'string') {
                urlService += '?id='+id
            }
            Ext.Ajax.request({
               url: urlService,
               success: function(req) {
                      var jsFromXml = req.responseXML || new OpenLayers.Format.XML().read(req.responseText);
                      var jsonObject = {services: [], layers: []};
                      /*
                       * Implementing rules from the wiki :
                       *
                       *  1. if multiple WMC docs are selected in
                       *  GeoNetwork the latter will refuse to open the MapFish app
                       *
                       *  2. if a WMC doc and WMS items (layers or services) are selected
                       *  in GeoNetwork the latter will refuse to open the MapFish app
                       *
                       *  3. if WMS services are selected the MapFish app will open a dialog
                       *  window for the user to select layers
                       *
                       */
                      var wmcCount = 0;
                      var wmsCount = 0;
                      Ext.each(jsFromXml.getElementsByTagName('service'), function(item, index, array) {
                          var owsType = item.getAttribute('owstype');
                          jsonObject.services.push({
                            text: item.getAttribute('text'),
                            metadataURL: app.getCatalogue().services.mdShow + '?id=' + item.getAttribute('mdid'),
                            owstype: owsType,
                            owsurl: item.getAttribute('owsurl')
                          });

                          switch (owsType) {
                            case 'WMC':
                              wmcCount += 1;
                              break;

                            case 'WMS':
                              wmsCount += 1;
                              break;
                          }
                      });

                      Ext.each(jsFromXml.getElementsByTagName('layer'), function(item, index, array) {
                        var owsType = item.getAttribute('owstype');

                        jsonObject.layers.push({
                          layername: item.getAttribute('layername'),
                          metadataURL: app.getCatalogue().services.mdShow + '?id=' + item.getAttribute('mdid'),
                          owstype: owsType,
                          owsurl: item.getAttribute('owsurl')
                        });

                        switch (owsType) {
                          case 'WMC':
                            wmcCount += 1;
                            break;
                          case 'WMS':
                            wmsCount += 1;
                            break;
                        }
                      });

                      /* Checking inputs - rule #1 */
                      if (wmcCount > 1) {
                        alert(translate("invalidSelectionMoreThanOneWMC"));
                        return;
                      }
                      /* rule #2 */
                      if ((wmcCount > 0) && (wmsCount > 0)) {
                        alert(translate("invalidSelectionOneWMCandOneOrMoreWMS"));
                       return;
                      }
                      /* new rule : No data (no WMS nor WMC) available into
                       * selected MDs. Alerting the user
                       */
                      if ((wmcCount == 0) && (wmsCount == 0)) {
                        alert(translate("invalidSelectionnoWMCnorWMS"));
                        return;
                      }

                      var form = Ext.DomHelper.append(Ext.getBody(), {
                        tag: 'form',
                        action: destUrl,
                        target: "_blank",
                        method: 'post'
                      });

                      var input = Ext.DomHelper.append(form, {
                        tag: 'input',
                        name: 'data'
                      });

                      input.value = new OpenLayers.Format.JSON().write(jsonObject);
                      form.submit();
                      Ext.removeNode(form);
                    }
            });
        },
        /**
         * Do layout
         *
         * @param response
         * @return
         */
        loadResults: function (response) {
            
            initPanels();
            facetsPanel.refresh(response);
            // FIXME : result panel need to update layout in case of slider
            // Ext.getCmp('resultsPanel').syncSize();
            Ext.getCmp('previousBt').setDisabled(catalogue.startRecord === 1);
            Ext.getCmp('nextBt').setDisabled(catalogue.startRecord + 
                    parseInt(Ext.getCmp('E_hitsperpage').getValue(), 10) > catalogue.metadataStore.totalLength);
            if (Ext.getCmp('E_sortBy').getValue()) {
                Ext.getCmp('sortByToolBar').setValue(Ext.getCmp('E_sortBy').getValue()  + "#" + Ext.getCmp('sortOrder').getValue());
            } else {
                Ext.getCmp('sortByToolBar').setValue(Ext.getCmp('E_sortBy').getValue());
            }
            
            resultsPanel.syncSize();
            resultsPanel.setHeight(Ext.getCmp('center').getHeight());
            
            Ext.getCmp('west').syncSize();
            Ext.getCmp('center').syncSize();
            Ext.ux.Lightbox.register('a[rel^=lightbox]');
            
            // Update page title based on search results and params
            var formParams = GeoNetwork.util.SearchTools.getFormValues(searchForm);
            var criteria = '', 
                excludedSearchParam = {E_hitsperpage: null, timeType: null,
                sortOrder: null, sortBy: null};
            for (var item in formParams) {
                if (formParams.hasOwnProperty(item) && excludedSearchParam[item] === undefined) {
                    var value = formParams[item];
                    if (value != '') {
                        fieldName = item.split('_');
                        criteria += OpenLayers.i18n(fieldName[1] || item) + ': ' + value + ' - '
                    }
                }
            }
            var title = (catalogue.metadataStore.totalLength || 0) + OpenLayers.i18n('recordsFound')
                           + (criteria !== '' ? ' | ' + criteria : '');
            
            GeoNetwork.Util.updateHeadInfo({
                title: catalogue.getInfo().name + ' | ' + title
            });
        }
    };
};

Ext.onReady(function () {
    var lang = /hl=([a-z]{3})/.exec(location.href);
    GeoNetwork.Util.setLang(lang && lang[1], '..');

    Ext.QuickTips.init();
    setTimeout(function () {
        Ext.get('loading').remove();
        Ext.get('loading-mask').fadeOut({remove: true});
    }, 250);
    
    app = new GeoNetwork.app();
    app.init();
    catalogue = app.getCatalogue();
    
    /* Focus on full text search field */
    Ext.getDom('E_any').focus(true);
});
