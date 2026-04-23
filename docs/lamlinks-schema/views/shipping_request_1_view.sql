-- dbo.shipping_request_1_view



/* view shipping_request_1_view: add view */


/* view shipping_request_1_view: add view */


/* view shipping_request_1_view: add view */

/* view shipping_request_1_view: add view */


/* view shipping_request_1_view: add view */


/* view shipping_request_1_view: add view */


/* view shipping_request_1_view: add view */


/* view shipping_request_1_view: add view */


/* view shipping_request_1_view: add view */


/* view shipping_request_1_view: add view */


/* view shipping_request_1_view: add view */


/* view shipping_request_1_view: add view */


/* view shipping_request_1_view: add view */


/* view shipping_request_1_view: add view */


/* view shipping_request_1_view: add view */


/* view shipping_request_1_view: add view */


/* view shipping_request_1_view: add view */


/* view shipping_request_1_view: add view */
CREATE VIEW [dbo].[shipping_request_1_view]
AS
SELECT     dbo.carrier_account_1_view.e_name_car, dbo.carrier_account_1_view.catdes_via, dbo.carrier_account_1_view.catdes_typ, dbo.carrier_account_1_view.cactno_kcw, 
                      dbo.kcu_tab.sprnum_kcu, dbo.kcu_tab.sprtyp_kcu, dbo.carrier_account_1_view.idnkcw_kcw, dbo.kcu_tab.idnkcu_kcu, dbo.kcu_tab.srssta_kcu, dbo.kcu_tab.srsdte_kcu, 
                      dbo.kcu_tab.ormnum_kcu
FROM         dbo.kcu_tab INNER JOIN
                      dbo.carrier_account_1_view ON dbo.kcu_tab.idnkcw_kcu = dbo.carrier_account_1_view.idnkcw_kcw


















