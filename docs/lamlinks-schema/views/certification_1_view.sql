-- dbo.certification_1_view



/* view certification_1_view: add view */


/* view certification_1_view: add view */


/* view certification_1_view: add view */

/* view certification_1_view: add view */


/* view certification_1_view: add view */


/* view certification_1_view: add view */


/* view certification_1_view: add view */


/* view certification_1_view: add view */


/* view certification_1_view: add view */


/* view certification_1_view: add view */


/* view certification_1_view: add view */


/* view certification_1_view: add view */


/* view certification_1_view: add view */


/* view certification_1_view: add view */


/* view certification_1_view: add view */


/* view certification_1_view: add view */


/* view certification_1_view: add view */


/* view certification_1_view: add view */
CREATE VIEW [dbo].[certification_1_view]
AS
SELECT     TOP (100) PERCENT dbo.supplier_invoice_line_1_view.s_code_k39, dbo.supplier_invoice_line_1_view.e_name_k12, dbo.supplier_invoice_line_1_view.sinnum_ka1, 
                      dbo.supplier_invoice_line_1_view.sil_no_ka2, dbo.inventory_part_received_1_view.por_no_k89, dbo.inventory_part_received_1_view.fsc_k08, 
                      dbo.inventory_part_received_1_view.niin_k08, dbo.inventory_part_received_1_view.prtnum_k71, dbo.inventory_part_received_1_view.p_desc_k71, 
                      dbo.inventory_part_received_1_view.instat_k93, dbo.inventory_part_received_1_view.plr_no_k98, dbo.inventory_part_received_1_view.pklqty_kbh, 
                      dbo.inventory_part_received_1_view.rcvqty_kbh, dbo.kbk_tab.sinqty_kbk, dbo.supplier_invoice_line_1_view.silqty_ka2, 
                      dbo.inventory_part_received_1_view.idnk93_k93, dbo.kbk_tab.idnkbk_kbk, dbo.inventory_part_received_1_view.idnkbh_kbh
FROM         dbo.inventory_part_received_1_view INNER JOIN
                      dbo.kbk_tab ON dbo.inventory_part_received_1_view.idnkbh_kbh = dbo.kbk_tab.idnkbh_kbk INNER JOIN
                      dbo.supplier_invoice_line_1_view ON dbo.kbk_tab.idnka2_kbk = dbo.supplier_invoice_line_1_view.idnka2_ka2


















