-- dbo.ship_out_k81_line_1_view_simicolon



/* view ship_out_k81_line_1_view_simicolon: add view */


/* view ship_out_k81_line_1_view_simicolon: add view */


/* view ship_out_k81_line_1_view_simicolon: add view */

/* view ship_out_k81_line_1_view_simicolon: add view */
CREATE VIEW dbo.ship_out_k81_line_1_view_simicolon
AS
SELECT        dbo.ship_out_line_1_view.sprtyp_kcu, dbo.ship_out_line_1_view.sprnum_kcu, dbo.ship_out_line_1_view.rtnsta_kcv, dbo.ship_out_line_1_view.srlqty_kcv, dbo.ship_out_line_1_view.ormnum_kcu, 
                         dbo.ship_out_line_1_view.srssta_kcu, dbo.ship_out_line_1_view.srsdte_kcu, dbo.ship_out_line_1_view.cactyp_kcw, dbo.ship_out_line_1_view.cactno_kcw, dbo.ship_out_line_1_view.afttab_kcv, 
                         dbo.ship_out_line_1_view.idnaft_kcv, dbo.ship_out_line_1_view.idnkcv_kcv, dbo.ship_out_line_1_view.idnkcu_kcu, dbo.ship_out_line_1_view.idnkcw_kcw, dbo.shipment_1_view.cntrct_k79, dbo.shipment_1_view.piidno_k80, 
                         dbo.shipment_1_view.rel_no_k80, dbo.shipment_1_view.clinno_k81, dbo.shipment_1_view.shpnum_kaj, dbo.shipment_1_view.idnk81_k81
FROM            dbo.ship_out_line_1_view INNER JOIN
                         dbo.shipment_1_view ON dbo.ship_out_line_1_view.idnaft_kcv = dbo.shipment_1_view.idnk81_k81
WHERE        (dbo.ship_out_line_1_view.afttab_kcv = 'k81')




