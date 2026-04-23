-- dbo.shipping_request_line_1_view



/* view shipping_request_line_1_view: add view */


/* view shipping_request_line_1_view: add view */


/* view shipping_request_line_1_view: add view */

/* view shipping_request_line_1_view: add view */


/* view shipping_request_line_1_view: add view */


/* view shipping_request_line_1_view: add view */


/* view shipping_request_line_1_view: add view */


/* view shipping_request_line_1_view: add view */


/* view shipping_request_line_1_view: add view */


/* view shipping_request_line_1_view: add view */
/* view shipping_request_line_1_view: add view 
 view shipping_request_line_1_view: add view 
 view shipping_request_line_1_view: add view 
 view shipping_request_line_1_view: add view 
 view shipping_request_line_1_view: add view 
 view shipping_request_line_1_view: add view 
 view shipping_request_line_1_view: add view 
 view shipping_request_line_1_view: add view */
CREATE VIEW [dbo].[shipping_request_line_1_view]
AS
SELECT        dbo.shipping_request_1_view.e_name_car, dbo.shipping_request_1_view.catdes_typ, dbo.shipping_request_1_view.catdes_via, dbo.shipping_request_1_view.cactno_kcw, 
                         dbo.shipping_request_1_view.sprtyp_kcu, dbo.kcv_tab.srstab_kcv, dbo.kcv_tab.idnsrs_kcv, dbo.kcv_tab.afttab_kcv, dbo.kcv_tab.idnaft_kcv, dbo.shipping_request_1_view.idnkcu_kcu, dbo.kcv_tab.idnkcv_kcv, 
                         dbo.shipping_request_1_view.sprnum_kcu, dbo.shipping_request_1_view.srssta_kcu, dbo.shipping_request_1_view.srsdte_kcu, dbo.kcv_tab.rtnsta_kcv, dbo.kcv_tab.rtndte_kcv, dbo.kcv_tab.srl_no_kcv, 
                         dbo.kcv_tab.srlqty_kcv, dbo.kcv_tab.rtnqty_kcv, dbo.shipping_request_1_view.idnkcw_kcw, dbo.shipping_request_1_view.ormnum_kcu
FROM            dbo.kcv_tab INNER JOIN
                         dbo.shipping_request_1_view ON dbo.kcv_tab.idnkcu_kcv = dbo.shipping_request_1_view.idnkcu_kcu










