define(["jquery", "knockout", "transitions/entrance", "plugins/dialog"],
    // Create a dialog using Bootstrap 3
    function ($, ko, entrance, dialog) {

        dialog.currentZIndex = 1700;
        var blockoutOpacity = 0.2;

        function newGuid() {
            function s4() {
                return Math.floor((1 + Math.random()) * 0x10000)
                    .toString(16)
                    .substring(1);
            }
            return s4() + s4() + "-" + s4() + "-" + s4() + "-" +
                s4() + "-" + s4() + s4() + s4();
        }

        function setInitialFocus($modal) {
            var autoFocusElement = $modal.find("[autofocus]");
            if (autoFocusElement.length) {
                autoFocusElement.focus();
                autoFocusElement.select();
            }
        }

        dialog.addContext("bsModal", {
            addHost: function (theDialog) {
                var body = $("body");
                var modalId = theDialog.settings.model.modalId = theDialog.settings.model.modalId || "modal_" + newGuid();
                var modalStyle = theDialog.settings.model.modalStyle || "modal-fade-in-scale-up ";
                modalStyle += " modal-default ";

                var modalFormat = '<div class="modal   fade {1}" id="{0}" data-keyboard="false" data-backdrop="static" tabindex="-1" role="dialog" aria-hidden="true"></div>'
                var modal = $(String.format(modalFormat, modalId, modalStyle))
                    .css({ "z-index": dialog.getNextZIndex() })
                    .appendTo(body);

                theDialog.host = modal.get(0);
            },
            removeHost: function (theDialog) {
                setTimeout(function () {

                    var modalId = theDialog.settings.model.modalId;
                    var $modal = $("#" + modalId);

                    $modal.modal("hide");
                    if($(".modal-backdrop").length===1){
                        $("body").removeClass("modal-open");
                    }
                    ko.removeNode(theDialog.host);
                    $modal.remove();

                    $(".modal-backdrop:last").remove();
                }, 200);

            },
            compositionComplete: function (child, parent, context) {
                var modalId = context.model.modalId = context.model.modalId || "modal_" + newGuid();

                var theDialog = dialog.getDialog(context.model);
                var $modal = $("#" + modalId);
                $modal.modal("show");
                $modal.on("shown.bs.modal", function () {
                    var zIndex = dialog.getNextZIndex();
                    $(this).css("z-index", zIndex);
                    setTimeout(function () {
                        $(".modal-backdrop").not(".modal-stack").css("z-index", zIndex - 1).addClass("modal-stack");
                    }, 0);

                    $(document).off("focusin.modal");
                    setTimeout(function () { return setInitialFocus($modal); }, 100);
                });




            }
        });


        var bsModal = function () { };
        bsModal.install = function () { };

        return bsModal;
    });
