-- dbo.a_po_part_1_view



/* view a_po_part_1_view: add view */


/* view a_po_part_1_view: add view */


/* view a_po_part_1_view: add view */

/* view a_po_part_1_view: add view */


/* view a_po_part_1_view: add view */
CREATE VIEW [dbo].[a_po_part_1_view]
AS
SELECT     dbo.k12_tab.e_code_k12, dbo.k12_tab.e_name_k12, dbo.k89_tab.por_no_k89, dbo.k71_tab.prtnum_k71, dbo.k71_tab.p_desc_k71, dbo.k08_tab.fsc_k08, 
                      dbo.k08_tab.niin_k08, dbo.k39_tab.idnk39_k39, dbo.k89_tab.idnk89_k89, dbo.k90_tab.idnk90_k90, dbo.k71_tab.idnk71_k71, dbo.k08_tab.idnk08_k08
FROM         dbo.k89_tab INNER JOIN
                      dbo.k90_tab ON dbo.k89_tab.idnk89_k89 = dbo.k90_tab.idnk89_k90 INNER JOIN
                      dbo.k71_tab ON dbo.k90_tab.idnk71_k90 = dbo.k71_tab.idnk71_k71 INNER JOIN
                      dbo.k08_tab ON dbo.k71_tab.idnk08_k71 = dbo.k08_tab.idnk08_k08 INNER JOIN
                      dbo.k39_tab ON dbo.k89_tab.idnk39_k89 = dbo.k39_tab.idnk39_k39 INNER JOIN
                      dbo.k12_tab ON dbo.k39_tab.idnk12_k39 = dbo.k12_tab.idnk12_k12





