-- dbo.k57_to_k43_view



/* view k57_to_k43_view: add view */


/* view k57_to_k43_view: add view */


/* view k57_to_k43_view: add view */
CREATE VIEW dbo.k57_to_k43_view
AS
SELECT        dbo.k57_tab.idnk57_k57, dbo.k56_tab.idnk43_k56 AS IDNK43_K43
FROM            dbo.k57_tab INNER JOIN
                         dbo.k56_tab ON dbo.k57_tab.idnk56_k57 = dbo.k56_tab.idnk56_k56



