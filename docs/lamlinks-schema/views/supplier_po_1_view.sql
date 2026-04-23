-- dbo.supplier_po_1_view



/* view supplier_po_1_view: add view */


/* view supplier_po_1_view: add view */


/* view supplier_po_1_view: add view */

/* view supplier_po_1_view: add view */


/* view supplier_po_1_view: add view */


/* view supplier_po_1_view: add view */


/* view supplier_po_1_view: add view */


/* view supplier_po_1_view: add view */


/* view supplier_po_1_view: add view */


/* view supplier_po_1_view: add view */


/* view supplier_po_1_view: add view */


/* view supplier_po_1_view: add view */


/* view supplier_po_1_view: add view */


/* view supplier_po_1_view: add view */


/* view supplier_po_1_view: add view */


/* view supplier_po_1_view: add view */


/* view supplier_po_1_view: add view */


/* view supplier_po_1_view: add view */
CREATE VIEW [dbo].[supplier_po_1_view]
AS
SELECT     dbo.supplier_1_view.s_code_k39, dbo.supplier_1_view.e_name_k12, dbo.k89_tab.por_no_k89, dbo.k89_tab.po_dte_k89, dbo.k89_tab.idnk89_k89, 
                      dbo.supplier_1_view.idnk12_k12, dbo.supplier_1_view.idnk39_k39, dbo.k89_tab.po_val_k89, dbo.k89_tab.rcedte_k89, dbo.k89_tab.rcvsta_k89, 
                      dbo.k89_tab.poddte_k89, dbo.k89_tab.podsta_k89, dbo.k89_tab.poadds_k89, dbo.k89_tab.poloct_k89, dbo.k89_tab.polact_k89, dbo.k89_tab.poruno_k89, 
                      dbo.k89_tab.cnt_no_k89
FROM         dbo.supplier_1_view INNER JOIN
                      dbo.k89_tab ON dbo.supplier_1_view.idnk39_k39 = dbo.k89_tab.idnk39_k89


















