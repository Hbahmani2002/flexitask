define(["require", "exports", "durandal/composition", "knockout", "jquery"], function (require, exports, composition, ko, $) {

    function NumberFormatBindingHandler() {


    }

    NumberFormatBindingHandler.install = function () {
        if (!ko.bindingHandlers.numberFormat) {
            ko.bindingHandlers.numberFormat = new NumberFormatBindingHandler();

          //  composition.addBindingHandler('panelActions');
        }
    };


    NumberFormatBindingHandler.prototype.init = function (element, valueAccessor) {
        var value = valueAccessor();
		var interceptor = ko.computed({
			read: function() {
                return numeral(ko.unwrap(value)).format('0,0.00');
			},
			write: function(newValue) {
                var num = numeral(newValue)
             
                value(num.value());
                value.valueHasMutated();
			}
        }).extend({notify: 'always'});
		if(element.tagName.toLowerCase() == 'input' )
			ko.applyBindingsToNode(element, {
                value: interceptor
			});
		else
			ko.applyBindingsToNode(element, {
				text: interceptor
			});
	}
        
  


    

    return NumberFormatBindingHandler;
});

