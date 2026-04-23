-- dbo.part_2_view



/* view part_2_view: add view */


/* view part_2_view: add view */


/* view part_2_view: add view */

/* view part_2_view: add view */


/* view part_2_view: add view */


/* view part_2_view: add view */


/* view part_2_view: add view */


/* view part_2_view: add view */


/* view part_2_view: add view */


/* view part_2_view: add view */


/* view part_2_view: add view */


/* view part_2_view: add view */


/* view part_2_view: add view */


/* view part_2_view: add view */


/* view part_2_view: add view */


/* view part_2_view: add view */


/* view part_2_view: add view */


/* view part_2_view: add view */
CREATE VIEW [dbo].[part_2_view]
AS
SELECT     dbo.k08_tab.fsc_k08, dbo.k08_tab.niin_k08, dbo.k71_tab.prtnum_k71, dbo.k71_tab.pn_rev_k71, dbo.k71_tab.p_desc_k71, dbo.k13_tab.cage_k13 AS e_code_mfg, 
                      dbo.k13_tab.c_name_k13 AS e_name_mfg, dbo.k71_tab.p_um_k71, dbo.k08_tab.idnk08_k08, dbo.k13_tab.idnk13_k13, dbo.k71_tab.idnk71_k71, 
                      dbo.k08_tab.partno_k08, dbo.k71_tab.nhacnt_k71, dbo.k71_tab.cmpcnt_k71, dbo.k08_tab.p_desc_k08
FROM         dbo.k08_tab INNER JOIN
                      dbo.k71_tab ON dbo.k08_tab.idnk08_k08 = dbo.k71_tab.idnk08_k71 INNER JOIN
                      dbo.k13_tab ON dbo.k71_tab.idnk13_k71 = dbo.k13_tab.idnk13_k13 AND dbo.k71_tab.idnk13_k71 = dbo.k13_tab.idnk13_k13


















