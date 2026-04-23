-- dbo.supplier_po_part_delivery_1_view



/* view supplier_po_part_delivery_1_view: add view */


/* view supplier_po_part_delivery_1_view: add view */


/* view supplier_po_part_delivery_1_view: add view */

/* view supplier_po_part_delivery_1_view: add view */


/* view supplier_po_part_delivery_1_view: add view */


/* view supplier_po_part_delivery_1_view: add view */


/* view supplier_po_part_delivery_1_view: add view */


/* view supplier_po_part_delivery_1_view: add view */


/* view supplier_po_part_delivery_1_view: add view */


/* view supplier_po_part_delivery_1_view: add view */


/* view supplier_po_part_delivery_1_view: add view */


/* view supplier_po_part_delivery_1_view: add view */


/* view supplier_po_part_delivery_1_view: add view */


/* view supplier_po_part_delivery_1_view: add view */


/* view supplier_po_part_delivery_1_view: add view */


/* view supplier_po_part_delivery_1_view: add view */


/* view supplier_po_part_delivery_1_view: add view */


/* view supplier_po_part_delivery_1_view: add view */
CREATE VIEW [dbo].[supplier_po_part_delivery_1_view]
AS
SELECT     dbo.supplier_po_part_1_view.fsc_k08, dbo.supplier_po_part_1_view.niin_k08, dbo.supplier_po_part_1_view.prtnum_k71, dbo.supplier_po_part_1_view.pn_rev_k71, 
                      dbo.supplier_po_part_1_view.p_desc_k71, dbo.supplier_po_part_1_view.s_code_k39, dbo.supplier_po_part_1_view.e_name_k12, 
                      dbo.supplier_po_part_1_view.por_no_k89, dbo.supplier_po_part_1_view.idnk90_k90, dbo.k91_tab.dlyseq_k91, dbo.k91_tab.reqdly_k91, dbo.k91_tab.po_qty_k91, 
                      dbo.k91_tab.idnk91_k91
FROM         dbo.supplier_po_part_1_view INNER JOIN
                      dbo.k91_tab ON dbo.supplier_po_part_1_view.idnk90_k90 = dbo.k91_tab.idnk90_k91


















